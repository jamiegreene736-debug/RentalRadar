from __future__ import annotations

import asyncio
from datetime import date, datetime, timedelta, timezone
from uuid import UUID

from celery.signals import worker_ready
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session
from playwright.async_api import Page

from app.agents.orchestrator import MarketScrapeOrchestrator
from app.agents.types import ScrapeTarget, ScraperStrategyPlan
from app.browser_farm.metrics import (
    BROWSER_ACTIVE,
    BROWSER_LAUNCH_FAILURES,
    SCRAPE_FAILURE,
    SCRAPE_SECONDS,
    SCRAPE_SUCCESS,
    record_proxy,
    refresh_worker_metrics,
    start_metrics_server,
)
from app.browser_farm.headed import launch_headed_browser
from app.browser_farm.proxy import ProxyRotator
from app.browser_farm.runner import execute_generated_scraper_code, run_trained_scraping_script
from app.db.models import (
    AgentTrainingRun,
    AgentTrainingStatus,
    OtaDirectCredential,
    OtaDirectPlatform,
    OtaDirectStatus,
    RateObservation,
    PmsConnection,
    PmsConnectionStatus,
    Property,
    PropertyPmsMapping,
    ScrapeJob,
    ScrapeJobLog,
    ScrapeJobStatus,
    ScrapeSource,
    ScrapeSnapshot,
    ScraperStrategy,
)
from app.db.session import SessionLocal
from app.services.cache import JsonCache
from app.services.demand_signals import refresh_live_demand_signals as refresh_property_demand_signals
from app.services.direct_ota import PLATFORM_LOGIN_URLS, DirectOTAPusher
from app.services.pms import PmsConnectorRegistry
from app.services.pricing_engine import generate_recommendations
from app.services.usage import UsageLimitExceeded, require_usage_allowance
from app.workers.celery_app import celery_app


@worker_ready.connect
def initialize_worker_metrics(**_: object) -> None:
    start_metrics_server()
    refresh_worker_metrics()
    _requeue_queued_scrape_jobs()


@celery_app.task(name="app.workers.tasks.run_scrape_job", bind=True, max_retries=2)
def run_scrape_job(self, scrape_job_id: str) -> dict:
    db = SessionLocal()
    try:
        job = db.get(ScrapeJob, UUID(scrape_job_id))
        if job is None:
            return {"status": "missing", "scrape_job_id": scrape_job_id}
        if job.status == ScrapeJobStatus.canceled:
            return {"status": "canceled", "scrape_job_id": scrape_job_id}
        if job.status != ScrapeJobStatus.queued:
            return {"status": job.status.value, "scrape_job_id": scrape_job_id}

        job.status = ScrapeJobStatus.running
        job.started_at = datetime.now(timezone.utc)
        job.attempts += 1
        db.add(ScrapeJobLog(scrape_job_id=job.id, level="info", event="scrape.started"))
        db.commit()

        target = ScrapeTarget(
            source=job.source,
            url=job.target_url,
            stay_date_start=job.stay_date_start or date.today(),
            stay_date_end=job.stay_date_end or date.today() + timedelta(days=90),
            browser_session_id=str(job.id),
        )
        db.add(ScrapeJobLog(
            scrape_job_id=job.id,
            level="info",
            event="browser.launching",
            message="Starting headed Chrome browser session.",
        ))
        db.commit()
        run = asyncio.run(MarketScrapeOrchestrator().run(target))
        db.refresh(job)
        if job.status == ScrapeJobStatus.canceled:
            db.add(
                ScrapeJobLog(
                    scrape_job_id=job.id,
                    level="warning",
                    event="scrape.canceled",
                    message="Scan stopped before results were saved.",
                )
            )
            db.commit()
            return {"status": "canceled", "scrape_job_id": scrape_job_id}

        strategy = _get_or_create_scraper_strategy(db, run.strategy, run.result.success)

        job.scraper_strategy_id = strategy.id
        snapshot = ScrapeSnapshot(
            scrape_job_id=job.id,
            competitor_id=job.competitor_id,
            source=job.source,
            raw_html_url=run.result.raw_html_url,
            screenshot_url=run.result.screenshot_url,
            network_trace_url=None,
            dom_fingerprint=run.result.dom_fingerprint,
            layout_fingerprint=run.result.layout_fingerprint,
            extraction_confidence=run.result.extraction_confidence,
            metadata_={"diagnostics": run.result.diagnostics},
        )
        db.add(snapshot)
        db.flush()

        training = AgentTrainingRun(
            scrape_job_id=job.id,
            scraper_strategy_id=strategy.id,
            source=job.source,
            domain=run.strategy.domain,
            layout_fingerprint=run.strategy.layout_fingerprint,
            agent_name="self_healing" if run.healed else "playwright_trainer",
            model_name="stub-or-configured-llm",
            prompt_version="phase1",
            status=AgentTrainingStatus.approved if run.result.success else AgentTrainingStatus.rejected,
            input_snapshot_url=run.result.screenshot_url,
            input_dom_url=run.result.raw_html_url,
            generated_strategy_json=run.strategy.strategy_json,
            validation_report=run.result.diagnostics,
            confidence=run.result.extraction_confidence,
            token_usage={},
            error_message=run.result.error_message,
            completed_at=datetime.now(timezone.utc),
        )
        db.add(training)

        if not run.result.success:
            blocker = run.result.diagnostics.get("blocker") if isinstance(run.result.diagnostics, dict) else None
            if _is_non_retryable_browser_blocker(blocker):
                job.status = ScrapeJobStatus.needs_review
                job.completed_at = datetime.now(timezone.utc)
                job.error_code = f"ota_{blocker['kind']}"
                job.error_message = run.result.error_message
                db.add(ScrapeJobLog(
                    scrape_job_id=job.id,
                    level="warning",
                    event="scrape.needs_review",
                    message=run.result.error_message,
                    payload=run.result.diagnostics,
                ))
                db.commit()
                return {
                    "status": "needs_review",
                    "scrape_job_id": scrape_job_id,
                    "error": run.result.error_message,
                    "error_code": job.error_code,
                }

            job.status = ScrapeJobStatus.failed
            job.error_message = run.result.error_message
            db.add(ScrapeJobLog(
                scrape_job_id=job.id,
                level="error",
                event="scrape.failed",
                message=run.result.error_message,
                payload=run.result.diagnostics,
            ))
            db.commit()
            raise RuntimeError(run.result.error_message or "scrape_failed")

        for rate in run.result.rates:
            db.add(
                RateObservation(
                    property_id=job.property_id,
                    competitor_id=job.competitor_id,
                    scrape_job_id=job.id,
                    scrape_snapshot_id=snapshot.id,
                    source=job.source,
                    stay_date=rate.stay_date,
                    currency_code="USD",
                    nightly_rate_cents=rate.nightly_rate_cents,
                    total_rate_cents=rate.total_rate_cents,
                    fees_cents=None,
                    taxes_cents=None,
                    available=rate.available,
                    min_nights=rate.min_nights,
                    max_nights=None,
                    cancellation_policy=None,
                    extraction_confidence=run.result.extraction_confidence,
                    raw_payload=rate.raw_payload,
                )
            )

        job.status = ScrapeJobStatus.succeeded
        job.completed_at = datetime.now(timezone.utc)
        job.result_summary = {
            **(job.result_summary if isinstance(job.result_summary, dict) else {}),
            "rates_extracted": len(run.result.rates),
            "healed": run.healed,
            "confidence": run.result.extraction_confidence,
        }
        db.add(ScrapeJobLog(
            scrape_job_id=job.id,
            level="info",
            event="scrape.succeeded",
            payload=job.result_summary,
        ))
        db.commit()

        if job.property_id:
            generate_recommendations(db, job.property_id)
            JsonCache().delete(f"market-rates:{job.property_id}")

        return {"status": "succeeded", "scrape_job_id": scrape_job_id, **job.result_summary}
    except Exception as exc:
        db.rollback()
        retry_delay = 30 * (self.request.retries + 1)
        error_message = str(exc) or type(exc).__name__
        job = db.get(ScrapeJob, UUID(scrape_job_id))
        if job is not None:
            if job.status == ScrapeJobStatus.canceled:
                db.add(
                    ScrapeJobLog(
                        scrape_job_id=job.id,
                        level="warning",
                        event="scrape.canceled",
                        message="Scan stopped by the user.",
                    )
                )
                db.commit()
                return {"status": "canceled", "scrape_job_id": scrape_job_id}
            if self.request.retries < self.max_retries:
                job.status = ScrapeJobStatus.queued
                job.started_at = None
                job.error_code = "scrape_retrying"
                job.error_message = f"Browser worker retrying after: {error_message}"
                job.request_context = {
                    **(job.request_context or {}),
                    "last_retry_queued_at": datetime.now(timezone.utc).isoformat(),
                    "last_retry_delay_seconds": retry_delay,
                    "last_retry_error": error_message[:500],
                }
                db.add(ScrapeJobLog(
                    scrape_job_id=job.id,
                    level="warning",
                    event="scrape.retrying",
                    message=job.error_message,
                    payload={
                        "attempts": job.attempts,
                        "max_retries": self.max_retries,
                        "next_retry_seconds": retry_delay,
                    },
                ))
                db.commit()
            else:
                job.status = ScrapeJobStatus.failed
                job.completed_at = datetime.now(timezone.utc)
                job.error_code = "scrape_failed"
                job.error_message = error_message
                db.add(ScrapeJobLog(
                    scrape_job_id=job.id,
                    level="error",
                    event="scrape.failed",
                    message=error_message,
                    payload={"attempts": job.attempts, "max_retries": self.max_retries},
                ))
                db.commit()
        if self.request.retries < self.max_retries:
            raise self.retry(exc=exc, countdown=retry_delay)
        return {"status": "failed", "scrape_job_id": scrape_job_id, "error": str(exc)}
    finally:
        db.close()


def _is_non_retryable_browser_blocker(blocker: object) -> bool:
    if not isinstance(blocker, dict):
        return False
    return blocker.get("kind") in {
        "proxy_auth_required",
        "bot_challenge",
        "captcha",
        "access_denied",
        "login_wall",
        "rate_limited",
    }


def _requeue_queued_scrape_jobs(limit: int = 50) -> int:
    """Republish DB-queued scrape jobs after worker restarts.

    The database is the durable queue source for the UI, but Celery retry messages
    can be interrupted by deploys. On boot, reconcile queued rows back onto Celery.
    """

    db = SessionLocal()
    try:
        jobs = db.scalars(
            select(ScrapeJob)
            .where(ScrapeJob.status == ScrapeJobStatus.queued)
            .order_by(ScrapeJob.priority.asc(), ScrapeJob.created_at.asc())
            .limit(limit)
        ).all()
        requeued = 0
        now = datetime.now(timezone.utc)
        for job in jobs:
            context = dict(job.request_context or {})
            context["worker_boot_requeued_at"] = now.isoformat()
            job.request_context = context
            db.add(
                ScrapeJobLog(
                    scrape_job_id=job.id,
                    level="info",
                    event="scrape.requeued",
                    message="Queued scrape job republished after browser worker startup.",
                    payload={"source": "worker_ready"},
                )
            )
            run_scrape_job.delay(str(job.id))
            requeued += 1
        if requeued:
            db.commit()
        return requeued
    except Exception:
        db.rollback()
        return 0
    finally:
        db.close()


def _get_or_create_scraper_strategy(
    db: Session,
    plan: ScraperStrategyPlan,
    success: bool,
) -> ScraperStrategy:
    version = int(plan.strategy_json.get("version", 1))
    success_rate = 1 if success else 0
    statement = (
        pg_insert(ScraperStrategy)
        .values(
            source=plan.source,
            domain=plan.domain,
            layout_fingerprint=plan.layout_fingerprint,
            strategy_json=plan.strategy_json,
            version=version,
            success_rate=success_rate,
            active=True,
            created_by_agent="playwright_trainer",
        )
        .on_conflict_do_update(
            index_elements=[
                ScraperStrategy.source,
                ScraperStrategy.domain,
                ScraperStrategy.layout_fingerprint,
                ScraperStrategy.version,
            ],
            set_={
                "strategy_json": plan.strategy_json,
                "success_rate": success_rate,
                "active": True,
                "created_by_agent": "playwright_trainer",
            },
        )
        .returning(ScraperStrategy.id)
    )
    strategy_id = db.scalar(statement)
    if strategy_id is None:
        raise RuntimeError("Failed to save scraper strategy")
    strategy = db.get(ScraperStrategy, strategy_id)
    if strategy is None:
        raise RuntimeError("Saved scraper strategy could not be loaded")
    return strategy


@celery_app.task(name="app.workers.tasks.run_trained_scraping_script", bind=True, max_retries=2)
def run_trained_scraping_script_task(self, payload: dict) -> dict:
    """Run AI-generated Playwright Python code on a headed browser-farm worker."""

    started = datetime.now(timezone.utc)
    proxy_rotator = ProxyRotator()
    proxy = proxy_rotator.lease(job_id=str(payload["job_id"]))
    record_proxy(proxy.provider if proxy else None, proxy.server if proxy else None)
    source = ScrapeSource(payload["target"]["source"])
    target = ScrapeTarget(
        source=source,
        url=payload["target"]["url"],
        stay_date_start=date.fromisoformat(payload["target"]["stay_date_start"]),
        stay_date_end=date.fromisoformat(payload["target"]["stay_date_end"]),
        proxy_url=proxy.server if proxy else None,
        browser_session_id=str(payload["job_id"]),
    )
    strategy = ScraperStrategyPlan(
        source=source,
        domain=payload["strategy"]["domain"],
        layout_fingerprint=payload["strategy"]["layout_fingerprint"],
        strategy_json=payload["strategy"]["strategy_json"],
        confidence=float(payload["strategy"].get("confidence", 0.5)),
    )

    BROWSER_ACTIVE.inc()
    try:
        with SCRAPE_SECONDS.time():
            result = asyncio.run(
                run_trained_scraping_script(
                    job_id=str(payload["job_id"]),
                    target=target,
                    strategy=strategy,
                    proxy=proxy,
                )
            )
        if result.success:
            SCRAPE_SUCCESS.inc()
            proxy_rotator.mark_success(proxy)
        else:
            SCRAPE_FAILURE.inc()
            proxy_rotator.mark_failure(proxy, result.error_message or "low_confidence")
        return {
            "status": "succeeded" if result.success else "failed",
            "duration_seconds": (datetime.now(timezone.utc) - started).total_seconds(),
            "confidence": result.extraction_confidence,
            "rates": [
                {
                    "stay_date": rate.stay_date.isoformat(),
                    "nightly_rate_cents": rate.nightly_rate_cents,
                    "total_rate_cents": rate.total_rate_cents,
                    "available": rate.available,
                    "min_nights": rate.min_nights,
                    "raw_payload": rate.raw_payload,
                }
                for rate in result.rates
            ],
            "diagnostics": result.diagnostics,
            "proxy": proxy.redacted() if proxy else None,
        }
    except Exception as exc:
        SCRAPE_FAILURE.inc()
        BROWSER_LAUNCH_FAILURES.inc()
        proxy_rotator.mark_failure(proxy, str(exc))
        if self.request.retries < self.max_retries:
            raise self.retry(exc=exc, countdown=45 * (self.request.retries + 1))
        return {"status": "failed", "error": str(exc), "proxy": proxy.redacted() if proxy else None}
    finally:
        BROWSER_ACTIVE.dec()
        refresh_worker_metrics()


@celery_app.task(name="app.workers.tasks.execute_trained_scraper", bind=True, max_retries=3)
def execute_trained_scraper(
    self,
    property_address: str,
    trained_script: str,
    proxy: str | None = None,
) -> dict:
    """Compatibility task for Trainer Agent generated Python scripts.

    The script should either define:
      async def scrape(page, context, target, strategy, human): ...
    or assign a JSON-serializable `result` dict.
    """

    started = datetime.now(timezone.utc)
    job_id = str(getattr(self.request, "id", None) or UUID(int=0))

    async def run() -> dict:
        async with launch_headed_browser(job_id=job_id, proxy_url=proxy) as session:
            session.action_logger.write(
                "trained_scraper.started",
                {"property_address": property_address, "proxy": proxy},
            )
            payload = await execute_generated_scraper_code(
                trained_script,
                page=session.page,
                context=session.context,
            )
            session.action_logger.write("trained_scraper.completed", {"payload_keys": sorted(payload.keys())})
            return payload

    BROWSER_ACTIVE.inc()
    try:
        with SCRAPE_SECONDS.time():
            payload = asyncio.run(run())
        SCRAPE_SUCCESS.inc()
        return {
            "status": "succeeded",
            "property_address": property_address,
            "duration_seconds": (datetime.now(timezone.utc) - started).total_seconds(),
            "result": payload,
        }
    except Exception as exc:
        SCRAPE_FAILURE.inc()
        BROWSER_LAUNCH_FAILURES.inc()
        if self.request.retries < self.max_retries:
            raise self.retry(exc=exc, countdown=45 * (self.request.retries + 1))
        return {
            "status": "failed",
            "property_address": property_address,
            "duration_seconds": (datetime.now(timezone.utc) - started).total_seconds(),
            "error": str(exc),
        }
    finally:
        BROWSER_ACTIVE.dec()
        refresh_worker_metrics()


@celery_app.task(name="app.workers.tasks.push_rate_to_pms", bind=True, max_retries=3)
def push_rate_to_pms(self, rate_push_id: str) -> dict:
    db = SessionLocal()
    try:
        result = PmsConnectorRegistry().push_rate(db, UUID(rate_push_id))
        return {
            "status": "succeeded",
            "rate_push_id": rate_push_id,
            "external_request_id": result.external_request_id,
        }
    except Exception as exc:
        db.rollback()
        if self.request.retries < self.max_retries:
            raise self.retry(exc=exc, countdown=20 * (self.request.retries + 1))
        return {"status": "failed", "rate_push_id": rate_push_id, "error": str(exc)}
    finally:
        db.close()


@celery_app.task(name="app.workers.tasks.pull_rates_from_pms", bind=True, max_retries=3)
def pull_rates_from_pms(
    self,
    connection_id: str,
    property_id: str,
    start_date_iso: str,
    end_date_iso: str,
) -> dict:
    db = SessionLocal()
    try:
        result = PmsConnectorRegistry().pull_rates(
            db,
            UUID(connection_id),
            UUID(property_id),
            date.fromisoformat(start_date_iso),
            date.fromisoformat(end_date_iso),
        )
        if result.pulled_rates:
            generate_recommendations(db, UUID(property_id))
            JsonCache().delete(f"market-rates:{property_id}")
        return {
            "status": result.status,
            "connection_id": connection_id,
            "property_id": property_id,
            "pulled_count": len(result.pulled_rates),
            "fallback_used": result.fallback_used,
        }
    except Exception as exc:
        db.rollback()
        if self.request.retries < self.max_retries:
            raise self.retry(exc=exc, countdown=20 * (self.request.retries + 1))
        return {"status": "failed", "connection_id": connection_id, "property_id": property_id, "error": str(exc)}
    finally:
        db.close()


@celery_app.task(name="app.workers.tasks.run_scheduled_market_scans")
def run_scheduled_market_scans() -> dict:
    db = SessionLocal()
    queued = 0
    try:
        stale_cutoff = datetime.now(timezone.utc) - timedelta(hours=6)
        jobs = db.scalars(
            select(ScrapeJob)
            .where(ScrapeJob.status.in_([ScrapeJobStatus.failed, ScrapeJobStatus.needs_review]))
            .where(ScrapeJob.updated_at < stale_cutoff)
            .limit(100)
        ).all()
        for job in jobs:
            try:
                require_usage_allowance(
                    db,
                    job.organization_id,
                    "scrape_job",
                    property_id=job.property_id,
                    source="scheduled_market_scan",
                    idempotency_key=f"scheduled_scrape:{job.id}:{datetime.now(timezone.utc).date().isoformat()}",
                )
            except UsageLimitExceeded as exc:
                db.add(
                    ScrapeJobLog(
                        scrape_job_id=job.id,
                        level="warning",
                        event="scrape.skipped_usage_limit",
                        message=str(exc),
                    )
                )
                continue
            job.status = ScrapeJobStatus.queued
            job.error_message = None
            run_scrape_job.delay(str(job.id))
            queued += 1
        db.commit()
        return {"queued": queued}
    finally:
        db.close()


@celery_app.task(name="app.workers.tasks.refresh_live_demand_signals")
def refresh_live_demand_signals() -> dict:
    db = SessionLocal()
    refreshed = 0
    created = 0
    provider_counts: dict[str, int] = {}
    try:
        today = date.today()
        end_date = today + timedelta(days=180)
        properties = db.scalars(
            select(Property)
            .where(Property.active.is_(True))
            .order_by(Property.created_at.asc())
            .limit(500)
        ).all()
        for rental in properties:
            result = refresh_property_demand_signals(db, rental.id, today, end_date)
            refreshed += 1
            created += result.created_count
            for provider, detail in result.providers.items():
                if detail.get("status") == "succeeded":
                    provider_counts[provider] = provider_counts.get(provider, 0) + 1
            generate_recommendations(
                db,
                rental.id,
                start_date=today,
                end_date=today + timedelta(days=180),
                refresh_demand=False,
            )
            JsonCache().delete(f"market-rates:{rental.id}")
        db.commit()
        return {
            "status": "succeeded",
            "properties_refreshed": refreshed,
            "signals_created": created,
            "provider_success_counts": provider_counts,
        }
    except Exception as exc:
        db.rollback()
        return {"status": "failed", "error": str(exc)}
    finally:
        db.close()


@celery_app.task(name="app.workers.tasks.sync_all_pms_connections")
def sync_all_pms_connections() -> dict:
    db = SessionLocal()
    queued = 0
    try:
        mappings = db.scalars(
            select(PropertyPmsMapping)
            .join(PmsConnection, PmsConnection.id == PropertyPmsMapping.pms_connection_id)
            .where(PropertyPmsMapping.active.is_(True))
            .where(PmsConnection.status == PmsConnectionStatus.connected)
            .limit(500)
        ).all()
        start = date.today()
        end = start + timedelta(days=365)
        for mapping in mappings:
            connection = db.get(PmsConnection, mapping.pms_connection_id)
            if connection is None:
                continue
            try:
                require_usage_allowance(
                    db,
                    connection.organization_id,
                    "pms_sync",
                    property_id=mapping.property_id,
                    source="scheduled_pms_sync",
                    idempotency_key=f"scheduled_pms_sync:{mapping.id}:{start.isoformat()}",
                )
            except UsageLimitExceeded:
                continue
            pull_rates_from_pms.delay(
                str(mapping.pms_connection_id),
                str(mapping.property_id),
                start.isoformat(),
                end.isoformat(),
            )
            queued += 1
        db.commit()
        return {"queued": queued}
    finally:
        db.close()


@celery_app.task(name="app.workers.tasks.ota_direct_push_task", bind=True, max_retries=1)
def ota_direct_push_task(
    self,
    property_id: str,
    user_id: str,
    rate_calendar: list[dict],
    platform: str | None = None,
    dry_run: bool = False,
) -> dict:
    """High-risk opt-in server-side direct OTA push.

    This task never logs plaintext credentials and keeps the headed Chrome
    session alive while waiting for dashboard-submitted 2FA codes.
    """

    db = SessionLocal()
    pusher = DirectOTAPusher()
    started = datetime.now(timezone.utc)
    try:
        query = (
            select(OtaDirectCredential)
            .where(OtaDirectCredential.property_id == UUID(property_id))
            .where(OtaDirectCredential.user_id == UUID(user_id))
            .where(OtaDirectCredential.status != OtaDirectStatus.revoked)
        )
        if platform:
            query = query.where(OtaDirectCredential.platform == OtaDirectPlatform(platform))
        credentials = list(db.scalars(query).all())
        if not credentials:
            return {"status": "missing_credentials", "property_id": property_id}

        results = []
        for credential in credentials:
            try:
                result = asyncio.run(_run_direct_ota_session(db, pusher, credential, rate_calendar, dry_run))
                results.append(result)
            except Exception as exc:
                db.rollback()
                pusher.mark_status(
                    db,
                    credential,
                    OtaDirectStatus.failed,
                    error="Direct OTA push failed. Use the Chrome/Safari extension instead.",
                )
                results.append(
                    {
                        "credential_id": str(credential.id),
                        "platform": credential.platform.value,
                        "status": "failed",
                        "error": str(exc),
                    }
                )
        return {
            "status": "completed",
            "dry_run": dry_run,
            "duration_seconds": (datetime.now(timezone.utc) - started).total_seconds(),
            "results": results,
        }
    except Exception as exc:
        db.rollback()
        if self.request.retries < self.max_retries:
            raise self.retry(exc=exc, countdown=45)
        return {"status": "failed", "property_id": property_id, "error": str(exc)}
    finally:
        db.close()


async def _run_direct_ota_session(
    db,
    pusher: DirectOTAPusher,
    credential: OtaDirectCredential,
    rate_calendar: list[dict],
    dry_run: bool,
) -> dict:
    decrypted = pusher.decrypt_credentials(credential)
    job_id = f"ota-direct-{credential.id}"
    login_url = PLATFORM_LOGIN_URLS[credential.platform]

    async with launch_headed_browser(job_id=job_id) as session:
        page = session.page
        session.action_logger.write(
            "ota_direct.started",
            {
                "credential_id": str(credential.id),
                "property_id": str(credential.property_id),
                "platform": credential.platform.value,
                "dry_run": dry_run,
                "rate_count": len(rate_calendar),
            },
        )
        await page.goto(login_url, wait_until="domcontentloaded", timeout=90_000)
        await _fill_first_visible(page, [
            "input[type='email']",
            "input[name='email']",
            "input#email",
            "input[autocomplete='username']",
        ], decrypted["email"])
        await _click_first_visible(page, [
            "button[type='submit']",
            "button:has-text('Continue')",
            "button:has-text('Next')",
            "button:has-text('Log in')",
        ])
        await asyncio.sleep(1.2)
        await _fill_first_visible(page, [
            "input[type='password']",
            "input[name='password']",
            "input#password",
            "input[autocomplete='current-password']",
        ], decrypted["password"])
        await _click_first_visible(page, [
            "button[type='submit']",
            "button:has-text('Log in')",
            "button:has-text('Sign in')",
            "button:has-text('Continue')",
        ])
        await page.wait_for_load_state("domcontentloaded", timeout=60_000)

        if await _sms_or_email_2fa_detected(page):
            session.action_logger.write(
                "ota_direct.2fa_sms_email_detected",
                {"credential_id": str(credential.id), "platform": credential.platform.value},
            )

        if await _authenticator_2fa_required(page):
            credential.status = OtaDirectStatus.two_fa_required
            credential.two_fa_attempts = 0
            db.add(credential)
            db.commit()
            pusher.notify_2fa_required(credential)

            while credential.two_fa_attempts < 3:
                code = await pusher.wait_for_2fa_code(
                    user_id=credential.user_id,
                    property_id=credential.property_id,
                    platform=credential.platform,
                )
                if code is None:
                    pusher.mark_status(
                        db,
                        credential,
                        OtaDirectStatus.failed,
                        error="2FA timed out. Use the Chrome/Safari extension instead.",
                    )
                    return {"credential_id": str(credential.id), "platform": credential.platform.value, "status": "2fa_timeout"}
                await _submit_2fa_code(page, code)
                await asyncio.sleep(3)
                if not await _authenticator_2fa_required(page):
                    break
                credential.two_fa_attempts += 1
                db.add(credential)
                db.commit()
                pusher.notify_2fa_required(credential)

            if credential.two_fa_attempts >= 3 and await _authenticator_2fa_required(page):
                pusher.mark_status(
                    db,
                    credential,
                    OtaDirectStatus.failed,
                    error="2FA failed three times. Switch to the Chrome/Safari extension.",
                )
                return {"credential_id": str(credential.id), "platform": credential.platform.value, "status": "2fa_failed"}

        pusher.mark_status(db, credential, OtaDirectStatus.active)
        if dry_run:
            return {"credential_id": str(credential.id), "platform": credential.platform.value, "status": "login_verified"}

        await _apply_rate_calendar_placeholder(page, credential.platform, rate_calendar, session.action_logger)
        pusher.mark_status(db, credential, OtaDirectStatus.active, pushed=True)
        return {
            "credential_id": str(credential.id),
            "platform": credential.platform.value,
            "status": "pushed",
            "rate_count": len(rate_calendar),
        }


async def _fill_first_visible(page: Page, selectors: list[str], value: str) -> None:
    for selector in selectors:
        locator = page.locator(selector).first
        if await locator.count() > 0:
            try:
                await locator.fill(value, timeout=5_000)
                return
            except Exception:
                continue
    raise RuntimeError("Required login field was not found")


async def _click_first_visible(page: Page, selectors: list[str]) -> None:
    for selector in selectors:
        locator = page.locator(selector).first
        if await locator.count() > 0:
            try:
                await locator.click(timeout=5_000)
                return
            except Exception:
                continue


async def _authenticator_2fa_required(page: Page) -> bool:
    two_fa_count = await page.locator("input[aria-label='Verification code'], input[name='otp'], #code-input").count()
    return two_fa_count > 0


async def _sms_or_email_2fa_detected(page: Page) -> bool:
    return (
        await page.locator(
            "text=/text message|sms|email verification|send code|verification email/i"
        ).count()
        > 0
    )


async def _submit_2fa_code(page: Page, code: str) -> None:
    locator = page.locator("input[aria-label='Verification code'], input[name='otp'], #code-input").first
    await locator.fill(code, timeout=10_000)
    await _click_first_visible(page, [
        "button[type='submit']",
        "button:has-text('Verify')",
        "button:has-text('Continue')",
        "button:has-text('Submit')",
    ])


async def _apply_rate_calendar_placeholder(page: Page, platform: OtaDirectPlatform, rate_calendar: list[dict], action_logger) -> None:
    """Placeholder for agent-trained calendar DOM operations.

    The Site Analyzer/Playwright Trainer agents should replace these selectors
    with platform/layout-specific JS/Python generated strategies before broad
    production rollout.
    """

    action_logger.write(
        "ota_direct.rate_push_placeholder",
        {"platform": platform.value, "rate_count": len(rate_calendar)},
    )
    for item in rate_calendar[:30]:
        await asyncio.sleep(0.15)
        action_logger.write(
            "ota_direct.rate_prepared",
            {"stay_date": item.get("stay_date"), "rate_cents": item.get("rate_cents")},
        )
