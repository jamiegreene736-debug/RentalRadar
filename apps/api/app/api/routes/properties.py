from __future__ import annotations

from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Property
from app.db.session import get_db
from app.deps import RequestContext, get_request_context
from app.schemas import (
    AddressPropertyCreate,
    MarketRatesResponse,
    PricingRecommendationResponse,
    PropertyResponse,
    RateObservationResponse,
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


def _float_or_none(value: Decimal | float | None) -> float | None:
    if value is None:
        return None
    return float(value)
