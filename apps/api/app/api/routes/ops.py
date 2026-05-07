from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from app.db.models import BillingEvent, PmsSyncRun, RatePush, ScrapeJob, ScrapeJobLog, ScrapeJobStatus
from app.db.session import get_db
from app.deps import RequestContext, get_request_context
from app.schemas import ErrorDashboardItem, ErrorDashboardResponse, ScrapingLegalNoticeResponse

router = APIRouter(tags=["ops"])


@router.get("/ops/errors", response_model=ErrorDashboardResponse)
def error_dashboard(
    db: Session = Depends(get_db),
    _: RequestContext = Depends(get_request_context),
) -> ErrorDashboardResponse:
    failed_scrapes = db.scalar(
        select(func.count(ScrapeJob.id)).where(
            ScrapeJob.status.in_([ScrapeJobStatus.failed, ScrapeJobStatus.needs_review])
        )
    ) or 0
    failed_syncs = db.scalar(select(func.count(PmsSyncRun.id)).where(PmsSyncRun.status.in_(["failed", "partial"]))) or 0
    failed_pushes = db.scalar(select(func.count(RatePush.id)).where(RatePush.status == "failed")) or 0
    failed_billing = db.scalar(
        select(func.count(BillingEvent.id)).where(
            (BillingEvent.processed.is_(False)) | (BillingEvent.error_message.is_not(None))
        )
    ) or 0

    scrape_jobs = db.scalars(
        select(ScrapeJob)
        .where(ScrapeJob.status.in_([ScrapeJobStatus.failed, ScrapeJobStatus.needs_review]))
        .order_by(desc(ScrapeJob.updated_at))
        .limit(20)
    ).all()
    scrape_logs = db.scalars(
        select(ScrapeJobLog)
        .where(ScrapeJobLog.level == "error")
        .order_by(desc(ScrapeJobLog.created_at))
        .limit(20)
    ).all()
    sync_runs = db.scalars(
        select(PmsSyncRun)
        .where(PmsSyncRun.status.in_(["failed", "partial"]))
        .order_by(desc(PmsSyncRun.created_at))
        .limit(10)
    ).all()
    rate_pushes = db.scalars(
        select(RatePush).where(RatePush.status == "failed").order_by(desc(RatePush.updated_at)).limit(10)
    ).all()
    billing_events = db.scalars(
        select(BillingEvent)
        .where((BillingEvent.processed.is_(False)) | (BillingEvent.error_message.is_not(None)))
        .order_by(desc(BillingEvent.created_at))
        .limit(10)
    ).all()

    recent = [
        ErrorDashboardItem(
            id=job.id,
            source=f"scrape:{job.source.value}",
            status=job.status.value,
            message=job.error_message,
            created_at=job.updated_at,
            detail={"target_url": job.target_url, "attempts": job.attempts},
        )
        for job in scrape_jobs
    ]
    recent.extend(
        ErrorDashboardItem(
            id=str(log.id),
            source="scrape_log",
            status=log.event,
            message=log.message,
            created_at=log.created_at,
            detail=log.payload,
        )
        for log in scrape_logs
    )
    recent.extend(
        ErrorDashboardItem(
            id=run.id,
            source=f"pms:{run.provider}",
            status=run.status,
            message=run.error_message,
            created_at=run.created_at,
            detail=run.response_summary,
        )
        for run in sync_runs
    )
    recent.extend(
        ErrorDashboardItem(
            id=push.id,
            source="rate_push",
            status=push.status,
            message=push.error_message,
            created_at=push.updated_at,
            detail=push.external_response,
        )
        for push in rate_pushes
    )
    recent.extend(
        ErrorDashboardItem(
            id=event.id,
            source="stripe",
            status=event.event_type,
            message=event.error_message,
            created_at=event.created_at,
            detail={"stripe_event_id": event.stripe_event_id},
        )
        for event in billing_events
    )
    recent.sort(key=lambda item: item.created_at or datetime.min.replace(tzinfo=timezone.utc), reverse=True)

    return ErrorDashboardResponse(
        counts={
            "failed_scrapes": int(failed_scrapes),
            "failed_pms_syncs": int(failed_syncs),
            "failed_rate_pushes": int(failed_pushes),
            "failed_billing_events": int(failed_billing),
        },
        recent_errors=recent[:50],
    )


@router.get("/legal/scraping-notice", response_model=ScrapingLegalNoticeResponse)
def scraping_legal_notice() -> ScrapingLegalNoticeResponse:
    return ScrapingLegalNoticeResponse(
        title="Live market data and scraping notice",
        body=(
            "RentalRadar is designed for authorized rate intelligence and channel operations. "
            "This notice is product guidance, not legal advice."
        ),
        commitments=[
            "Respect applicable site terms, robots directives where applicable, and user account permissions.",
            "Do not bypass paywalls, access controls, CAPTCHAs, or authentication barriers.",
            "Use proxies, retries, and rate limits to improve reliability and reduce service impact.",
            "Prefer official PMS and channel-manager APIs whenever they are available.",
        ],
        user_responsibilities=[
            "Connect only accounts and listings you are authorized to manage.",
            "Review third-party platform terms before enabling automated pulls or pushes.",
            "Validate recommendations before publishing rates to channels.",
            "Treat scraped data as best-effort market intelligence that can be incomplete or delayed.",
        ],
    )
