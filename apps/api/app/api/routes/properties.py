from __future__ import annotations

import base64
import json
from decimal import Decimal
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit, urlunsplit
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db.models import Property, ScrapeJob, ScrapeJobLog
from app.db.session import get_db
from app.deps import RequestContext, get_request_context
from app.schemas import (
    AddressPropertyCreate,
    MarketRatesResponse,
    PricingRecommendationResponse,
    PropertyResponse,
    RateObservationResponse,
    ScrapeSessionEventResponse,
    ScrapeSessionResponse,
    ScrapeSessionsResponse,
)
from app.services.cache import JsonCache
from app.services.market import create_property_and_jobs, get_market_rates
from app.services.usage import BillingRequired, UsageLimitExceeded, ensure_property_allowed, require_usage_allowance
from app.workers.tasks import run_scrape_job

router = APIRouter(tags=["properties"])


@router.post("/properties", response_model=PropertyResponse, status_code=201)
def create_property(
    payload: AddressPropertyCreate,
    db: Session = Depends(get_db),
    context: RequestContext = Depends(get_request_context),
) -> PropertyResponse:
    try:
        ensure_property_allowed(db, context.organization_id)
        require_usage_allowance(
            db,
            context.organization_id,
            "scrape_job",
            units=(len(payload.comp_urls) or 3) * 25,
            source="property_create.preflight",
            record=False,
        )
    except BillingRequired as exc:
        raise HTTPException(status_code=402, detail=str(exc)) from exc
    except UsageLimitExceeded as exc:
        raise HTTPException(status_code=429, detail=str(exc)) from exc

    rental, jobs = create_property_and_jobs(
        db=db,
        organization_id=context.organization_id,
        address=payload.address,
        name=payload.name,
        bedrooms=payload.bedrooms,
        bathrooms=payload.bathrooms,
        sleeps=payload.sleeps,
        property_type=payload.property_type,
        base_price_cents=payload.base_price_cents,
        min_price_cents=payload.min_price_cents,
        max_price_cents=payload.max_price_cents,
        comp_urls=[str(url) for url in payload.comp_urls],
        scan_days=payload.scan_days,
    )
    for job in jobs:
        require_usage_allowance(
            db,
            context.organization_id,
            "scrape_job",
            property_id=rental.id,
            source="property_create",
            idempotency_key=f"scrape_job:{job.id}",
        )
        run_scrape_job.delay(str(job.id))
    db.commit()

    return PropertyResponse(
        id=rental.id,
        organization_id=rental.organization_id,
        name=rental.name,
        formatted_address=rental.formatted_address,
        address_line1=rental.address_line1,
        bedrooms=rental.bedrooms,
        bathrooms=_float_or_none(rental.bathrooms),
        sleeps=rental.sleeps,
        market_scan_job_ids=[job.id for job in jobs],
    )


@router.get("/properties/{property_id}/market-rates", response_model=MarketRatesResponse)
def market_rates(
    property_id: UUID,
    db: Session = Depends(get_db),
    context: RequestContext = Depends(get_request_context),
) -> MarketRatesResponse:
    rental = db.scalar(
        select(Property)
        .where(Property.id == property_id)
        .where(Property.organization_id == context.organization_id)
    )
    if rental is None:
        raise HTTPException(status_code=404, detail="Property not found")

    cache_key = f"market-rates:{property_id}"
    cache = JsonCache()
    cached_payload = cache.get(cache_key)
    if isinstance(cached_payload, dict):
        return MarketRatesResponse(**cached_payload, cached=True)

    observations, recommendations = get_market_rates(db, property_id)
    response = MarketRatesResponse(
        property_id=property_id,
        cached=False,
        observations=[
            RateObservationResponse(
                id=row.id,
                source=row.source,
                competitor_id=row.competitor_id,
                stay_date=row.stay_date,
                nightly_rate_cents=row.nightly_rate_cents,
                total_rate_cents=row.total_rate_cents,
                available=row.available,
                extraction_confidence=_float_or_none(row.extraction_confidence),
                observed_at=row.observed_at,
            )
            for row in observations
        ],
        recommendations=[
            PricingRecommendationResponse(
                id=row.id,
                stay_date=row.stay_date,
                current_rate_cents=row.current_rate_cents,
                recommended_rate_cents=row.recommended_rate_cents,
                recommended_min_stay=row.recommended_min_stay,
                discount_percent=_float_or_none(row.discount_percent),
                confidence=_float_or_none(row.confidence),
                status=row.status.value,
                reason=row.reason,
            )
            for row in recommendations
        ],
    )
    cache.set(cache_key, response.model_dump(mode="json") | {"cached": False}, ttl_seconds=120)
    return response


@router.get("/properties/{property_id}/scrape-sessions", response_model=ScrapeSessionsResponse)
def scrape_sessions(
    property_id: UUID,
    db: Session = Depends(get_db),
    context: RequestContext = Depends(get_request_context),
) -> ScrapeSessionsResponse:
    rental = db.scalar(
        select(Property)
        .where(Property.id == property_id)
        .where(Property.organization_id == context.organization_id)
    )
    if rental is None:
        raise HTTPException(status_code=404, detail="Property not found")

    jobs = db.scalars(
        select(ScrapeJob)
        .where(ScrapeJob.property_id == property_id)
        .where(ScrapeJob.organization_id == context.organization_id)
        .order_by(desc(ScrapeJob.created_at))
        .limit(6)
    ).all()
    return ScrapeSessionsResponse(
        property_id=property_id,
        sessions=[_scrape_session_response(db, job) for job in jobs],
    )


def _float_or_none(value: Decimal | float | None) -> float | None:
    if value is None:
        return None
    return float(value)


def _scrape_session_response(db: Session, job: ScrapeJob) -> ScrapeSessionResponse:
    browser_events = _browser_action_events(str(job.id))
    db_events = _db_scrape_events(db, job.id)
    merged_events = sorted(
        [*db_events, *browser_events],
        key=lambda item: item.at,
        reverse=True,
    )[:18]
    current_url = next((event.url for event in browser_events if event.url), None)
    latest_screenshot_data_url = _latest_screenshot_data_url(str(job.id))
    return ScrapeSessionResponse(
        id=job.id,
        source=job.source,
        status=job.status.value,
        target_url=_safe_url(job.target_url),
        browser_session_id=str(job.id),
        started_at=job.started_at,
        completed_at=job.completed_at,
        current_url=current_url,
        latest_screenshot_data_url=latest_screenshot_data_url,
        events=merged_events,
    )


def _db_scrape_events(db: Session, job_id: UUID) -> list[ScrapeSessionEventResponse]:
    logs = db.scalars(
        select(ScrapeJobLog)
        .where(ScrapeJobLog.scrape_job_id == job_id)
        .order_by(desc(ScrapeJobLog.created_at))
        .limit(10)
    ).all()
    return [
        ScrapeSessionEventResponse(
            at=log.created_at,
            event=log.event,
            level=log.level,
            message=log.message,
        )
        for log in logs
    ]


def _browser_action_events(job_id: str) -> list[ScrapeSessionEventResponse]:
    path = Path(get_settings().browser_action_log_dir) / f"{job_id}.jsonl"
    if not path.exists():
        return []

    events: list[ScrapeSessionEventResponse] = []
    for line in _tail_lines(path, 80):
        try:
            record = json.loads(line)
        except json.JSONDecodeError:
            continue
        payload = record.get("payload") if isinstance(record.get("payload"), dict) else {}
        event_name = str(record.get("event") or "browser.event")
        event_at = _event_datetime(record.get("ts"))
        message = _event_message(event_name, payload)
        events.append(
            ScrapeSessionEventResponse(
                at=event_at,
                event=event_name,
                level="error" if event_name.endswith("failed") or event_name == "pageerror" else "info",
                message=message,
                url=_safe_url(str(payload["url"])) if payload.get("url") else None,
                status=payload.get("status") if isinstance(payload.get("status"), int) else None,
            )
        )
    return sorted(events, key=lambda item: item.at, reverse=True)


def _tail_lines(path: Path, limit: int) -> list[str]:
    try:
        with path.open("r", encoding="utf-8") as fh:
            lines = fh.readlines()
    except OSError:
        return []
    return lines[-limit:]


def _event_datetime(value: Any) -> datetime:
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            pass
    return datetime.now(timezone.utc)


def _event_message(event: str, payload: dict[str, Any]) -> str | None:
    if event == "browser.launched":
        return "Chrome session opened"
    if event == "request":
        return f"{payload.get('method', 'GET')} {_safe_url(str(payload.get('url', '')))}"
    if event == "response":
        return f"HTTP {payload.get('status')} {_safe_url(str(payload.get('url', '')))}"
    if event in {"scrape.page_loaded", "scrape.screenshot"}:
        return "Screen preview updated"
    if event == "scrape.completed":
        return "Extraction run finished"
    if event == "browser.shutdown":
        return "Chrome session closed"
    if "message" in payload:
        return str(payload["message"])
    return None


def _latest_screenshot_data_url(job_id: str) -> str | None:
    root = Path(get_settings().browser_action_log_dir)
    log_path = root / f"{job_id}.jsonl"
    for line in reversed(_tail_lines(log_path, 120)):
        try:
            record = json.loads(line)
        except json.JSONDecodeError:
            continue
        if record.get("event") not in {"scrape.page_loaded", "scrape.screenshot"}:
            continue
        payload = record.get("payload") if isinstance(record.get("payload"), dict) else {}
        screenshot_path = payload.get("screenshot_path")
        if not isinstance(screenshot_path, str):
            continue
        candidate = Path(screenshot_path)
        if not _is_inside(candidate, root):
            continue
        try:
            data = candidate.read_bytes()
        except OSError:
            continue
        return f"data:image/jpeg;base64,{base64.b64encode(data).decode('ascii')}"
    return None


def _is_inside(path: Path, root: Path) -> bool:
    try:
        path.resolve().relative_to(root.resolve())
        return True
    except ValueError:
        return False


def _safe_url(url: str) -> str:
    if not url:
        return url
    parsed = urlsplit(url)
    return urlunsplit((parsed.scheme, parsed.netloc, parsed.path, "", ""))
