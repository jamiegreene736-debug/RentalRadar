from __future__ import annotations

import asyncio
from datetime import date, datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import select

from app.agents.orchestrator import MarketScrapeOrchestrator
from app.agents.proxy import ProxyRotator
from app.agents.types import ScrapeTarget
from app.db.models import (
    AgentTrainingRun,
    AgentTrainingStatus,
    RateObservation,
    PmsConnection,
    PmsConnectionStatus,
    PropertyPmsMapping,
    ScrapeJob,
    ScrapeJobLog,
    ScrapeJobStatus,
    ScrapeSnapshot,
    ScraperStrategy,
)
from app.db.session import SessionLocal
from app.services.cache import JsonCache
from app.services.pms import PmsConnectorRegistry
from app.services.pricing_engine import generate_recommendations
from app.services.usage import UsageLimitExceeded, require_usage_allowance
from app.workers.celery_app import celery_app


@celery_app.task(name="app.workers.tasks.run_scrape_job", bind=True, max_retries=2)
def run_scrape_job(self, scrape_job_id: str) -> dict:
    db = SessionLocal()
    try:
        job = db.get(ScrapeJob, UUID(scrape_job_id))
        if job is None:
            return {"status": "missing", "scrape_job_id": scrape_job_id}

        job.status = ScrapeJobStatus.running
        job.started_at = datetime.now(timezone.utc)
        job.attempts += 1
        db.add(ScrapeJobLog(scrape_job_id=job.id, level="info", event="scrape.started"))
        db.commit()

        proxy = ProxyRotator().next_proxy()
        target = ScrapeTarget(
            source=job.source,
            url=job.target_url,
            stay_date_start=job.stay_date_start or date.today(),
            stay_date_end=job.stay_date_end or date.today() + timedelta(days=90),
            proxy_url=proxy,
        )
        run = asyncio.run(MarketScrapeOrchestrator().run(target))

        strategy = ScraperStrategy(
            source=run.strategy.source,
            domain=run.strategy.domain,
            layout_fingerprint=run.strategy.layout_fingerprint,
            strategy_json=run.strategy.strategy_json,
            version=run.strategy.strategy_json.get("version", 1),
            success_rate=1 if run.result.success else 0,
            active=True,
            created_by_agent="playwright_trainer",
        )
        db.add(strategy)
        db.flush()

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
        if self.request.retries < self.max_retries:
            raise self.retry(exc=exc, countdown=30 * (self.request.retries + 1))
        return {"status": "failed", "scrape_job_id": scrape_job_id, "error": str(exc)}
    finally:
        db.close()


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
