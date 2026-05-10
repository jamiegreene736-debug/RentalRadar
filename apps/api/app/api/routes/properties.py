from __future__ import annotations

import base64
import json
from decimal import Decimal
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit, urlunsplit
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from fastapi import Query
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db.models import (
    Competitor,
    PricingDemandSignal,
    Property,
    ScrapeJob,
    ScrapeJobLog,
    ScrapeJobStatus,
)
from app.db.session import get_db
from app.deps import RequestContext, get_request_context
from app.schemas import (
    AddressPropertyCreate,
    AddressSuggestionResponse,
    BaseRateModelResponse,
    CancelMarketScanResponse,
    MarketRatesResponse,
    MarketSourceEvidenceResponse,
    MonthlyRateForecastResponse,
    PricingAdjustmentLayerResponse,
    PricingControlsResponse,
    PricingControlsUpdate,
    PricingRecommendationResponse,
    PricingToolCoverageResponse,
    PropertyResponse,
    RateForecastNightResponse,
    RateForecastResponse,
    RateObservationResponse,
    ScrapeSessionEventResponse,
    ScrapeSessionResponse,
    ScrapeSessionsResponse,
    SeasonBandResponse,
    SeasonCalendarResponse,
    HolidayWindowResponse,
    BrowserEvidenceResponse,
    MarketScanResponse,
    SourceCheckResponse,
    TargetOccupancyNightResponse,
    TargetOccupancyPlanRequest,
    TargetOccupancyPlanResponse,
)
from app.services.cache import JsonCache
from app.services.demand_signals import refresh_live_demand_signals
from app.services.forecast import build_rate_forecast, build_target_occupancy_plan
from app.services.geocoding import suggest_addresses
from app.services.market import (
    create_property_and_jobs,
    default_market_targets,
    default_seasonal_market_targets,
    get_market_rates,
    infer_source,
)
from app.services.pricing_controls import apply_pricing_control_update, pricing_controls_for_property
from app.services.pricing_engine import generate_recommendations
from app.services.season_calendar import month_names, season_profile_for_property
from app.services.usage import BillingRequired, UsageLimitExceeded, ensure_property_allowed, require_usage_allowance
from app.workers.tasks import run_scrape_job

router = APIRouter(tags=["properties"])

STALE_RUNNING_SECONDS = 180
NOISY_BROWSER_HOSTS = {
    "browser-intake-datadoghq.com",
    "bat.bing.com",
    "www.google-analytics.com",
    "www.googletagmanager.com",
}
NOISY_BROWSER_PATH_PREFIXES = (
    "/api/v2/rum",
    "/api/uisprime/track",
)


@router.get("/address-suggestions", response_model=list[AddressSuggestionResponse])
async def address_suggestions(
    query: str = Query(min_length=3, max_length=160),
    limit: int = Query(default=5, ge=1, le=8),
) -> list[AddressSuggestionResponse]:
    return [AddressSuggestionResponse(**item) for item in await suggest_addresses(query, limit=limit)]


@router.post("/properties", response_model=PropertyResponse, status_code=201)
def create_property(
    payload: AddressPropertyCreate,
    db: Session = Depends(get_db),
    context: RequestContext = Depends(get_request_context),
) -> PropertyResponse:
    try:
        ensure_property_allowed(db, context.organization_id)
        preflight_job_count = len(payload.comp_urls) or len(default_seasonal_market_targets(payload.address))
        require_usage_allowance(
            db,
            context.organization_id,
            "scrape_job",
            units=preflight_job_count * 25,
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


@router.get("/properties", response_model=list[PropertyResponse])
def list_properties(
    db: Session = Depends(get_db),
    context: RequestContext = Depends(get_request_context),
) -> list[PropertyResponse]:
    rentals = db.scalars(
        select(Property)
        .where(Property.organization_id == context.organization_id)
        .where(Property.active.is_(True))
        .order_by(desc(Property.created_at))
        .limit(100)
    ).all()
    return [
        PropertyResponse(
            id=rental.id,
            organization_id=rental.organization_id,
            name=rental.name,
            formatted_address=rental.formatted_address,
            address_line1=rental.address_line1,
            bedrooms=rental.bedrooms,
            bathrooms=_float_or_none(rental.bathrooms),
            sleeps=rental.sleeps,
            market_scan_job_ids=[],
        )
        for rental in rentals
    ]


@router.post("/properties/{property_id}/market-scan", response_model=MarketScanResponse)
def queue_market_scan(
    property_id: UUID,
    scan_days: int = Query(default=90, ge=1, le=365),
    db: Session = Depends(get_db),
    context: RequestContext = Depends(get_request_context),
) -> MarketScanResponse:
    rental = db.scalar(
        select(Property)
        .where(Property.id == property_id)
        .where(Property.organization_id == context.organization_id)
        .where(Property.active.is_(True))
    )
    if rental is None:
        raise HTTPException(status_code=404, detail="Property not found")

    queued_job_ids = _queue_property_market_scans(
        db=db,
        rental=rental,
        scan_days=scan_days,
        context=context,
        trigger="manual_property_rerun",
    )
    return MarketScanResponse(
        property_id=rental.id,
        queued_job_ids=queued_job_ids,
        message=(
            "An active scan is already running for this property."
            if not queued_job_ids
            else f"Queued {len(queued_job_ids)} headed-browser market scan{'' if len(queued_job_ids) == 1 else 's'}."
        ),
    )


@router.post("/properties/{property_id}/source-check", response_model=SourceCheckResponse)
def check_all_pricing_sources(
    property_id: UUID,
    months: int = Query(default=6, ge=6, le=24),
    db: Session = Depends(get_db),
    context: RequestContext = Depends(get_request_context),
) -> SourceCheckResponse:
    rental = db.scalar(
        select(Property)
        .where(Property.id == property_id)
        .where(Property.organization_id == context.organization_id)
        .where(Property.active.is_(True))
    )
    if rental is None:
        raise HTTPException(status_code=404, detail="Property not found")

    scan_days = min(365, max(90, round(months * 30.4375)))
    queued_job_ids = _queue_property_market_scans(
        db=db,
        rental=rental,
        scan_days=scan_days,
        context=context,
        trigger="manual_source_check",
        months_ahead=months,
    )
    today = date.today()
    end_date = today + timedelta(days=scan_days)
    demand_result = refresh_live_demand_signals(db, property_id, today, end_date)
    recommendations = generate_recommendations(
        db,
        property_id,
        start_date=today,
        end_date=end_date,
        refresh_demand=False,
    )
    JsonCache().delete(f"market-rates:{property_id}")
    return SourceCheckResponse(
        property_id=property_id,
        queued_job_ids=queued_job_ids,
        demand_signal_count=demand_result.created_count,
        pricing_recommendation_count=len(recommendations),
        providers=demand_result.providers,
        message=(
            "Checked live OTA scans and refreshed event, weather, and flight demand data. "
            "New browser scans will continue updating recommendations as they finish."
        ),
    )


@router.post("/properties/{property_id}/market-scan/cancel", response_model=CancelMarketScanResponse)
def cancel_market_scan(
    property_id: UUID,
    db: Session = Depends(get_db),
    context: RequestContext = Depends(get_request_context),
) -> CancelMarketScanResponse:
    rental = db.scalar(
        select(Property)
        .where(Property.id == property_id)
        .where(Property.organization_id == context.organization_id)
        .where(Property.active.is_(True))
    )
    if rental is None:
        raise HTTPException(status_code=404, detail="Property not found")

    now = datetime.now(timezone.utc)
    jobs = db.scalars(
        select(ScrapeJob)
        .where(ScrapeJob.property_id == property_id)
        .where(ScrapeJob.organization_id == context.organization_id)
        .where(ScrapeJob.status.in_([ScrapeJobStatus.queued, ScrapeJobStatus.running]))
        .order_by(desc(ScrapeJob.created_at))
        .limit(100)
    ).all()
    canceled_ids: list[UUID] = []
    for job in jobs:
        job.status = ScrapeJobStatus.canceled
        job.completed_at = now
        job.error_code = "scan_canceled_by_user"
        job.error_message = "Scan stopped by the user."
        job.request_context = {
            **(job.request_context or {}),
            "canceled_by_user_at": now.isoformat(),
        }
        db.add(
            ScrapeJobLog(
                scrape_job_id=job.id,
                level="warning",
                event="scrape.canceled",
                message=job.error_message,
                payload={"source": "dashboard_stop_scan"},
            )
        )
        canceled_ids.append(job.id)

    db.commit()
    return CancelMarketScanResponse(
        property_id=property_id,
        canceled_job_ids=canceled_ids,
        canceled_count=len(canceled_ids),
        message=(
            "No queued or running scan jobs were active."
            if not canceled_ids
            else f"Stopped {len(canceled_ids)} queued/running scan job{'' if len(canceled_ids) == 1 else 's'}."
        ),
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


@router.get("/properties/{property_id}/rate-forecast", response_model=RateForecastResponse)
def rate_forecast(
    property_id: UUID,
    months: int = Query(default=6, ge=6, le=24),
    db: Session = Depends(get_db),
    context: RequestContext = Depends(get_request_context),
) -> RateForecastResponse:
    rental = db.scalar(
        select(Property)
        .where(Property.id == property_id)
        .where(Property.organization_id == context.organization_id)
    )
    if rental is None:
        raise HTTPException(status_code=404, detail="Property not found")

    observations, recommendations = get_market_rates(db, property_id)
    today = date.today()
    end_date = today + timedelta(days=round(months * 30.4375))
    refresh_live_demand_signals(db, property_id, today, end_date)
    demand_signals = list(
        db.scalars(
            select(PricingDemandSignal)
            .where(PricingDemandSignal.organization_id == context.organization_id)
            .where(PricingDemandSignal.starts_on <= end_date)
            .where(PricingDemandSignal.ends_on >= today)
            .where(
                (PricingDemandSignal.property_id.is_(None))
                | (PricingDemandSignal.property_id == property_id)
            )
        ).all()
    )
    forecast = build_rate_forecast(
        rental,
        recommendations,
        observations,
        months,
        demand_signals=demand_signals,
    )
    return RateForecastResponse(
        property_id=property_id,
        months=months,
        currency_code=rental.currency_code,
        address=rental.formatted_address,
        generated_at=forecast.generated_at,
        estimated_occupancy=forecast.estimated_occupancy,
        recommended_total_revenue_cents=forecast.recommended_total_revenue_cents,
        market_benchmark_total_revenue_cents=forecast.market_benchmark_total_revenue_cents,
        extra_income_vs_market_cents=forecast.extra_income_vs_market_cents,
        confidence=forecast.confidence,
        explanation=forecast.explanation,
        base_rate_model=BaseRateModelResponse(
            method=forecast.base_rate_model.method,
            base_rate_cents=forecast.base_rate_model.base_rate_cents,
            market_median_rate_cents=forecast.base_rate_model.market_median_rate_cents,
            market_average_rate_cents=forecast.base_rate_model.market_average_rate_cents,
            sample_size=forecast.base_rate_model.sample_size,
            source_count=forecast.base_rate_model.source_count,
            booked_rate_feed=forecast.base_rate_model.booked_rate_feed,
            explanation=forecast.base_rate_model.explanation,
        ),
        market_sources=[
            MarketSourceEvidenceResponse(
                source=source.source,
                label=source.label,
                role=source.role,
                status=source.status,
                sample_count=source.sample_count,
                median_rate_cents=source.median_rate_cents,
                average_rate_cents=source.average_rate_cents,
                low_rate_cents=source.low_rate_cents,
                high_rate_cents=source.high_rate_cents,
                confidence=source.confidence,
                last_observed_at=source.last_observed_at,
                note=source.note,
            )
            for source in forecast.market_sources
        ],
        adjustment_layers=[
            PricingAdjustmentLayerResponse(
                code=layer.code,
                label=layer.label,
                category=layer.category,
                data_feed=layer.data_feed,
                adjustment_percent=layer.adjustment_percent,
                rate_impact_cents=layer.rate_impact_cents,
                confidence=layer.confidence,
                status=layer.status,
                description=layer.description,
            )
            for layer in forecast.adjustment_layers
        ],
        pricing_tools=[
            PricingToolCoverageResponse(
                code=tool.code,
                label=tool.label,
                category=tool.category,
                status=tool.status,
                priority=tool.priority,
                current_value=tool.current_value,
                recommended_value=tool.recommended_value,
                control_references=tool.control_references,
                data_needed=tool.data_needed,
                description=tool.description,
            )
            for tool in forecast.pricing_tools
        ],
        monthly=[
            MonthlyRateForecastResponse(
                month=month.month,
                average_recommended_rate_cents=month.average_recommended_rate_cents,
                average_market_benchmark_rate_cents=month.average_market_benchmark_rate_cents,
                average_comp_blend_rate_cents=month.average_comp_blend_rate_cents,
                estimated_occupancy=month.estimated_occupancy,
                estimated_revenue_cents=month.estimated_revenue_cents,
                market_benchmark_revenue_cents=month.market_benchmark_revenue_cents,
                extra_income_vs_market_cents=month.extra_income_vs_market_cents,
            )
            for month in forecast.monthly
        ],
        nights=[
            RateForecastNightResponse(
                stay_date=night.stay_date,
                recommended_rate_cents=night.recommended_rate_cents,
                market_benchmark_rate_cents=night.market_benchmark_rate_cents,
                comp_blend_rate_cents=night.comp_blend_rate_cents,
                estimated_occupancy=night.estimated_occupancy,
                estimated_revenue_cents=night.estimated_revenue_cents,
                confidence=night.confidence,
            )
            for night in forecast.nights
        ],
    )


@router.get("/properties/{property_id}/pricing-controls", response_model=PricingControlsResponse)
def get_pricing_controls(
    property_id: UUID,
    db: Session = Depends(get_db),
    context: RequestContext = Depends(get_request_context),
) -> PricingControlsResponse:
    rental = _active_property(db, property_id, context.organization_id)
    controls = pricing_controls_for_property(rental)
    return PricingControlsResponse(property_id=property_id, **controls)


@router.patch("/properties/{property_id}/pricing-controls", response_model=PricingControlsResponse)
def update_pricing_controls(
    property_id: UUID,
    payload: PricingControlsUpdate,
    db: Session = Depends(get_db),
    context: RequestContext = Depends(get_request_context),
) -> PricingControlsResponse:
    rental = _active_property(db, property_id, context.organization_id)
    try:
        apply_pricing_control_update(rental, payload.model_dump(exclude_unset=True))
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    db.add(rental)
    db.commit()
    db.refresh(rental)
    try:
        JsonCache().delete(f"market-rates:{property_id}")
    except Exception:
        pass
    return PricingControlsResponse(property_id=property_id, **pricing_controls_for_property(rental))


@router.get("/properties/{property_id}/season-calendar", response_model=SeasonCalendarResponse)
def get_season_calendar(
    property_id: UUID,
    db: Session = Depends(get_db),
    context: RequestContext = Depends(get_request_context),
) -> SeasonCalendarResponse:
    rental = _active_property(db, property_id, context.organization_id)
    profile = season_profile_for_property(rental)
    return SeasonCalendarResponse(
        property_id=profile.property_id,
        market_key=profile.market_key,
        market_label=profile.market_label,
        basis=profile.basis,
        current_model_note=profile.current_model_note,
        seasons=[
            SeasonBandResponse(
                code=season.code,
                label=season.label,
                months=season.months,
                month_labels=month_names(season.months),
                multiplier=season.multiplier,
                minimum_stay_nights=season.minimum_stay_nights,
                booking_posture=season.booking_posture,
                notes=season.notes,
            )
            for season in profile.seasons
        ],
        holidays=[HolidayWindowResponse(**holiday.__dict__) for holiday in profile.holidays],
    )


@router.post("/properties/{property_id}/target-occupancy-plan", response_model=TargetOccupancyPlanResponse)
def target_occupancy_plan(
    property_id: UUID,
    payload: TargetOccupancyPlanRequest,
    db: Session = Depends(get_db),
    context: RequestContext = Depends(get_request_context),
) -> TargetOccupancyPlanResponse:
    rental = db.scalar(
        select(Property)
        .where(Property.id == property_id)
        .where(Property.organization_id == context.organization_id)
    )
    if rental is None:
        raise HTTPException(status_code=404, detail="Property not found")

    queued_job_ids: list[UUID] = []
    if payload.refresh_browser_data:
        queued_job_ids = _queue_target_month_browser_scans(
            db=db,
            rental=rental,
            target_month=payload.target_month,
            context=context,
        )

    observations, recommendations = get_market_rates(db, property_id)
    completed_scan_count = len(
        db.scalars(
            select(ScrapeJob.id)
            .where(ScrapeJob.property_id == property_id)
            .where(ScrapeJob.status == ScrapeJobStatus.succeeded)
        ).all()
    )
    plan = build_target_occupancy_plan(
        rental=rental,
        recommendations=recommendations,
        observations=observations,
        target_month=payload.target_month,
        target_occupancy=payload.target_occupancy,
        queued_job_ids=queued_job_ids,
        completed_scan_count=completed_scan_count,
    )
    return TargetOccupancyPlanResponse(
        property_id=property_id,
        currency_code=rental.currency_code,
        address=rental.formatted_address,
        generated_at=plan.generated_at,
        target_month=plan.target_month,
        target_occupancy=plan.target_occupancy,
        current_projected_occupancy=plan.current_projected_occupancy,
        suggested_average_rate_cents=plan.suggested_average_rate_cents,
        market_average_rate_cents=plan.market_average_rate_cents,
        rate_change_percent=plan.rate_change_percent,
        projected_revenue_cents=plan.projected_revenue_cents,
        confidence=plan.confidence,
        game_plan=plan.game_plan,
        browser_evidence=BrowserEvidenceResponse(
            status=plan.browser_evidence.status,
            queued_job_ids=plan.browser_evidence.queued_job_ids,
            completed_scan_count=plan.browser_evidence.completed_scan_count,
            observations_used=plan.browser_evidence.observations_used,
            latest_observed_at=plan.browser_evidence.latest_observed_at,
            sources=plan.browser_evidence.sources,
            message=plan.browser_evidence.message,
        ),
        nights=[
            TargetOccupancyNightResponse(
                stay_date=night.stay_date,
                suggested_rate_cents=night.suggested_rate_cents,
                market_rate_cents=night.market_rate_cents,
                expected_occupancy=night.expected_occupancy,
                strategy=night.strategy,
            )
            for night in plan.nights
        ],
    )


@router.get("/properties/{property_id}/scrape-sessions", response_model=ScrapeSessionsResponse)
def scrape_sessions(
    property_id: UUID,
    limit: int = Query(default=24, ge=1, le=100),
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

    _recover_stale_running_jobs(db, property_id, context.organization_id)

    jobs = db.scalars(
        select(ScrapeJob)
        .where(ScrapeJob.property_id == property_id)
        .where(ScrapeJob.organization_id == context.organization_id)
        .order_by(desc(ScrapeJob.created_at))
        .limit(limit)
    ).all()
    queue_positions = _queue_positions(db, context.organization_id)
    return ScrapeSessionsResponse(
        property_id=property_id,
        sessions=[_scrape_session_response(db, job, queue_positions.get(job.id)) for job in jobs],
    )


def _queue_target_month_browser_scans(
    *,
    db: Session,
    rental: Property,
    target_month: date,
    context: RequestContext,
) -> list[UUID]:
    month_start = date(target_month.year, target_month.month, 1)
    month_end = date(month_start.year + 1, 1, 1) if month_start.month == 12 else date(month_start.year, month_start.month + 1, 1)
    competitors = list(
        db.scalars(
            select(Competitor)
            .where(Competitor.property_id == rental.id)
            .where(Competitor.active.is_(True))
            .order_by(desc(Competitor.updated_at))
            .limit(8)
        ).all()
    )
    targets = [(competitor.external_url, competitor.source, competitor.id) for competitor in competitors]
    if not targets:
        address = rental.formatted_address or rental.address_line1
        targets = [(url, infer_source(url), None) for url in default_market_targets(address)]

    jobs: list[ScrapeJob] = []
    existing_job_ids: list[UUID] = []
    for target_url, source, competitor_id in targets:
        existing_job = db.scalar(
            select(ScrapeJob)
            .where(ScrapeJob.property_id == rental.id)
            .where(ScrapeJob.target_url == target_url)
            .where(ScrapeJob.stay_date_start == month_start)
            .where(ScrapeJob.stay_date_end == month_end - timedelta(days=1))
            .where(ScrapeJob.status.in_([ScrapeJobStatus.queued, ScrapeJobStatus.running]))
            .order_by(desc(ScrapeJob.created_at))
        )
        if existing_job is not None:
            existing_job_ids.append(existing_job.id)
            continue

        try:
            require_usage_allowance(
                db,
                context.organization_id,
                "scrape_job",
                property_id=rental.id,
                source="target_occupancy_plan",
                idempotency_key=f"target_occupancy:{rental.id}:{month_start.isoformat()}:{target_url}",
            )
        except BillingRequired as exc:
            raise HTTPException(status_code=402, detail=str(exc)) from exc
        except UsageLimitExceeded as exc:
            raise HTTPException(status_code=429, detail=str(exc)) from exc

        job = ScrapeJob(
            organization_id=context.organization_id,
            property_id=rental.id,
            competitor_id=competitor_id,
            source=source,
            target_url=target_url,
            stay_date_start=month_start,
            stay_date_end=month_end - timedelta(days=1),
            status=ScrapeJobStatus.queued,
            priority=15,
            request_context={
                "trigger": "target_occupancy_plan",
                "target_month": month_start.isoformat(),
            },
        )
        db.add(job)
        jobs.append(job)

    db.commit()
    for job in jobs:
        db.refresh(job)
        run_scrape_job.delay(str(job.id))
    return [*existing_job_ids, *[job.id for job in jobs]]


def _queue_property_market_scans(
    *,
    db: Session,
    rental: Property,
    scan_days: int,
    context: RequestContext,
    trigger: str,
    months_ahead: int = 24,
) -> list[UUID]:
    address = rental.formatted_address or rental.address_line1
    targets = default_seasonal_market_targets(address, months_ahead=months_ahead, stay_nights=7)

    jobs: list[ScrapeJob] = []
    active_job_ids: list[UUID] = []
    for target in targets:
        target_url = target.url
        source = infer_source(target_url)
        existing_job = db.scalar(
            select(ScrapeJob)
            .where(ScrapeJob.property_id == rental.id)
            .where(ScrapeJob.target_url == target_url)
            .where(ScrapeJob.status.in_([ScrapeJobStatus.queued, ScrapeJobStatus.running]))
            .order_by(desc(ScrapeJob.created_at))
        )
        if existing_job is not None:
            active_job_ids.append(existing_job.id)
            continue

        job = ScrapeJob(
            organization_id=context.organization_id,
            property_id=rental.id,
            competitor_id=None,
            source=source,
            target_url=target_url,
            stay_date_start=target.stay_date_start,
            stay_date_end=target.stay_date_end,
            status=ScrapeJobStatus.queued,
            priority=20,
            request_context={
                "trigger": trigger,
                "scan_days": scan_days,
                "season": target.season_label,
                "stay_nights": 7,
            },
        )
        db.add(job)
        db.flush()
        try:
            require_usage_allowance(
                db,
                context.organization_id,
                "scrape_job",
                property_id=rental.id,
                source=trigger,
                idempotency_key=f"scrape_job:{job.id}",
            )
        except BillingRequired as exc:
            raise HTTPException(status_code=402, detail=str(exc)) from exc
        except UsageLimitExceeded as exc:
            raise HTTPException(status_code=429, detail=str(exc)) from exc
        jobs.append(job)

    db.commit()
    for job in jobs:
        db.refresh(job)
        run_scrape_job.delay(str(job.id))
    return [*active_job_ids, *[job.id for job in jobs]]


def _recover_stale_running_jobs(db: Session, property_id: UUID, organization_id: UUID) -> None:
    now = datetime.now(timezone.utc)
    stale_jobs = db.scalars(
        select(ScrapeJob)
        .where(ScrapeJob.property_id == property_id)
        .where(ScrapeJob.organization_id == organization_id)
        .where(ScrapeJob.status == ScrapeJobStatus.running)
        .where(ScrapeJob.started_at.is_not(None))
        .where(ScrapeJob.started_at <= now - timedelta(seconds=STALE_RUNNING_SECONDS))
        .order_by(ScrapeJob.started_at.asc())
        .limit(6)
    ).all()
    requeue_ids: list[UUID] = []

    for job in stale_jobs:
        browser_events = _browser_action_events(str(job.id))
        db_events = _db_scrape_events(db, job.id)
        if _has_browser_evidence(db_events, browser_events) or _latest_screenshot_data_url(job):
            continue

        request_context = dict(job.request_context or {})
        stale_requeues = int(request_context.get("stale_heartbeat_requeues") or 0)
        if stale_requeues < 1 and job.attempts < job.max_attempts:
            request_context["stale_heartbeat_requeues"] = stale_requeues + 1
            request_context["stale_heartbeat_requeued_at"] = now.isoformat()
            job.status = ScrapeJobStatus.queued
            job.started_at = None
            job.completed_at = None
            job.error_code = "chrome_heartbeat_missing"
            job.error_message = "Chrome worker did not emit a browser heartbeat, so RentalRadar requeued this scan automatically."
            job.request_context = request_context
            db.add(ScrapeJobLog(
                scrape_job_id=job.id,
                level="warning",
                event="scrape.requeued",
                message=job.error_message,
                payload={"stale_after_seconds": STALE_RUNNING_SECONDS, "attempts": job.attempts},
            ))
            requeue_ids.append(job.id)
        else:
            request_context["stale_heartbeat_needs_review_at"] = now.isoformat()
            job.status = ScrapeJobStatus.needs_review
            job.completed_at = now
            job.error_code = "chrome_heartbeat_missing"
            job.error_message = "Chrome worker picked up the scan but never emitted a browser heartbeat."
            job.request_context = request_context
            db.add(ScrapeJobLog(
                scrape_job_id=job.id,
                level="error",
                event="scrape.needs_review",
                message=job.error_message,
                payload={"stale_after_seconds": STALE_RUNNING_SECONDS, "attempts": job.attempts},
            ))

    if stale_jobs:
        db.commit()
    for job_id in requeue_ids:
        run_scrape_job.delay(str(job_id))


def _active_property(db: Session, property_id: UUID, organization_id: UUID) -> Property:
    rental = db.scalar(
        select(Property)
        .where(Property.id == property_id)
        .where(Property.organization_id == organization_id)
        .where(Property.active.is_(True))
    )
    if rental is None:
        raise HTTPException(status_code=404, detail="Property not found")
    return rental


def _float_or_none(value: Decimal | float | None) -> float | None:
    if value is None:
        return None
    return float(value)


def _queue_positions(db: Session, organization_id: UUID) -> dict[UUID, int]:
    queued_ids = db.scalars(
        select(ScrapeJob.id)
        .where(ScrapeJob.organization_id == organization_id)
        .where(ScrapeJob.status == ScrapeJobStatus.queued)
        .order_by(ScrapeJob.priority.asc(), ScrapeJob.created_at.asc())
    ).all()
    return {job_id: index + 1 for index, job_id in enumerate(queued_ids)}


def _scrape_session_response(db: Session, job: ScrapeJob, queue_position: int | None = None) -> ScrapeSessionResponse:
    browser_events = _browser_action_events(str(job.id))
    db_events = _db_scrape_events(db, job.id)
    merged_events = sorted(
        [*db_events, *browser_events],
        key=lambda item: item.at,
        reverse=True,
    )[:18]
    current_url = _current_page_url(job.target_url, merged_events)
    latest_screenshot_data_url = _latest_screenshot_data_url(job)
    return ScrapeSessionResponse(
        id=job.id,
        source=job.source,
        status=job.status.value,
        target_url=_safe_url(job.target_url),
        browser_session_id=str(job.id),
        created_at=job.created_at,
        started_at=job.started_at,
        completed_at=job.completed_at,
        current_url=current_url,
        latest_screenshot_data_url=latest_screenshot_data_url,
        error_code=job.error_code,
        error_message=job.error_message,
        diagnostics=_scrape_diagnostics(job, merged_events),
        progress_percent=_scrape_progress_percent(job, merged_events, latest_screenshot_data_url, queue_position),
        progress_label=_scrape_progress_label(job, merged_events, queue_position),
        queue_position=queue_position,
        events=merged_events,
    )


def _scrape_progress_percent(
    job: ScrapeJob,
    browser_events: list[ScrapeSessionEventResponse],
    latest_screenshot_data_url: str | None,
    queue_position: int | None,
) -> int:
    if job.status == ScrapeJobStatus.succeeded:
        return 100
    if job.status in {ScrapeJobStatus.failed, ScrapeJobStatus.needs_review}:
        if latest_screenshot_data_url:
            return 82
        if browser_events:
            return 68
        return 34
    if job.status == ScrapeJobStatus.canceled:
        return 0
    if job.status == ScrapeJobStatus.running:
        if latest_screenshot_data_url:
            return 82
        if browser_events:
            return 68
        return 48
    if job.status == ScrapeJobStatus.queued:
        if queue_position == 1:
            return 28
        if queue_position == 2:
            return 22
        if queue_position is not None:
            return 16
        return 10
    return 5


def _scrape_progress_label(
    job: ScrapeJob,
    browser_events: list[ScrapeSessionEventResponse],
    queue_position: int | None,
) -> str:
    if job.status == ScrapeJobStatus.queued:
        if job.error_code == "chrome_heartbeat_missing":
            return "Requeued after Chrome heartbeat timeout"
        if queue_position is None:
            return "Queued for browser worker"
        return f"Queued for browser worker, position {queue_position}"
    if job.status == ScrapeJobStatus.running:
        if browser_events:
            return "Chrome is open and emitting browser events"
        if job.started_at and _seconds_since(job.started_at) >= STALE_RUNNING_SECONDS:
            return "No Chrome heartbeat yet; checking worker recovery"
        return "Chrome worker picked up the job"
    if job.status == ScrapeJobStatus.succeeded:
        return "Scan complete"
    if job.status == ScrapeJobStatus.failed:
        return job.error_message or "Scan failed"
    if job.status == ScrapeJobStatus.needs_review:
        return job.error_message or "Scan needs review"
    if job.status == ScrapeJobStatus.canceled:
        return "Scan canceled"
    return job.status.value.replace("_", " ")


def _seconds_since(value: datetime) -> float:
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return (datetime.now(timezone.utc) - value).total_seconds()


def _has_browser_evidence(
    db_events: list[ScrapeSessionEventResponse],
    browser_events: list[ScrapeSessionEventResponse],
) -> bool:
    evidence_events = {
        "browser.launched",
        "scrape.blocker_detected",
        "scrape.exception",
        "scrape.page_loaded",
        "scrape.live_screenshot",
        "scrape.proxy_tls_error",
        "scrape.rates_missing",
        "scrape.selector_missing",
        "scrape.screenshot",
        "scrape.completed",
        "screenshot.failed",
        "pageerror",
    }
    return any(event.event in evidence_events for event in [*db_events, *browser_events])


def _db_scrape_events(db: Session, job_id: UUID) -> list[ScrapeSessionEventResponse]:
    logs = db.scalars(
        select(ScrapeJobLog)
        .where(ScrapeJobLog.scrape_job_id == job_id)
        .order_by(desc(ScrapeJobLog.created_at))
        .limit(10)
    ).all()
    events: list[ScrapeSessionEventResponse] = []
    for log in logs:
        payload = log.payload if isinstance(log.payload, dict) else {}
        payload_url = payload.get("url") or payload.get("current_url")
        events.append(
            ScrapeSessionEventResponse(
                at=log.created_at,
                event=log.event,
                level=log.level,
                message=log.message,
                url=_safe_url(str(payload_url)) if payload_url else None,
                status=payload.get("status") if isinstance(payload.get("status"), int) else None,
                payload=_safe_payload(payload) if payload else None,
            )
        )
    return events


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
                level=_event_level(event_name),
                message=message,
                url=_safe_url(str(payload["url"])) if payload.get("url") else None,
                status=payload.get("status") if isinstance(payload.get("status"), int) else None,
                payload=_safe_payload(payload),
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
    if event in {"scrape.page_loaded", "scrape.live_screenshot", "scrape.screenshot"}:
        return "Screen preview updated"
    if event == "scrape.blocker_detected":
        return str(payload.get("message") or "Browser blocker detected")
    if event == "scrape.selector_missing":
        return str(payload.get("message") or "Expected selector was not found")
    if event == "scrape.exception":
        return str(payload.get("message") or "Playwright raised an exception")
    if event == "scrape.proxy_tls_error":
        return str(payload.get("message") or "Residential proxy certificate was rejected")
    if event == "scrape.rates_missing":
        return str(payload.get("message") or "No visible OTA prices were extracted")
    if event == "scrape.completed":
        return "Extraction run finished"
    if event == "browser.shutdown":
        return "Chrome session closed"
    if "message" in payload:
        return str(payload["message"])
    return None


def _event_level(event: str) -> str:
    if event in {"scrape.exception", "pageerror"} or event.endswith("failed"):
        return "error"
    if event in {"scrape.blocker_detected", "scrape.proxy_tls_error", "scrape.rates_missing", "scrape.selector_missing", "scrape.canceled", "scrape.needs_review"}:
        return "warning"
    return "info"


def _current_page_url(target_url: str, events: list[ScrapeSessionEventResponse]) -> str | None:
    for event in events:
        if event.url and _looks_like_page_url(event.url, target_url):
            return event.url
    return None


def _looks_like_page_url(url: str, target_url: str) -> bool:
    parsed = urlsplit(url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return False

    host = parsed.netloc.lower()
    if host in NOISY_BROWSER_HOSTS:
        return False
    if parsed.path.startswith(NOISY_BROWSER_PATH_PREFIXES):
        return False

    target_host = urlsplit(target_url).netloc.lower()
    if target_host and host != target_host:
        return _without_www(host) == _without_www(target_host)
    return True


def _without_www(host: str) -> str:
    return host[4:] if host.startswith("www.") else host


def _latest_screenshot_data_url(job: ScrapeJob) -> str | None:
    summary = job.result_summary if isinstance(job.result_summary, dict) else {}
    data_url = summary.get("latest_screenshot_data_url")
    if isinstance(data_url, str) and data_url.startswith("data:image/"):
        return data_url

    job_id = str(job.id)
    root = Path(get_settings().browser_action_log_dir)
    log_path = root / f"{job_id}.jsonl"
    for line in reversed(_tail_lines(log_path, 120)):
        try:
            record = json.loads(line)
        except json.JSONDecodeError:
            continue
        if record.get("event") not in {"scrape.page_loaded", "scrape.live_screenshot", "scrape.screenshot", "scrape.blocker_detected", "scrape.exception", "scrape.proxy_tls_error", "scrape.rates_missing", "scrape.selector_missing"}:
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


def _safe_payload(payload: dict[str, Any]) -> dict[str, Any]:
    safe = dict(payload)
    screenshot_path = safe.get("screenshot_path")
    if isinstance(screenshot_path, str):
        safe["screenshot_path"] = Path(screenshot_path).name
    for key in ("password", "token", "authorization", "cookie"):
        if key in safe:
            safe[key] = "[redacted]"
    return safe


def _scrape_diagnostics(job: ScrapeJob, events: list[ScrapeSessionEventResponse]) -> dict[str, Any]:
    result_summary = job.result_summary if isinstance(job.result_summary, dict) else {}
    return {
        "job_id": str(job.id),
        "source": job.source.value if hasattr(job.source, "value") else str(job.source),
        "status": job.status.value if hasattr(job.status, "value") else str(job.status),
        "target_url": _safe_url(job.target_url),
        "stay_date_start": job.stay_date_start.isoformat() if job.stay_date_start else None,
        "stay_date_end": job.stay_date_end.isoformat() if job.stay_date_end else None,
        "error_code": job.error_code,
        "error_message": job.error_message,
        "attempts": job.attempts,
        "started_at": job.started_at.isoformat() if job.started_at else None,
        "completed_at": job.completed_at.isoformat() if job.completed_at else None,
        "request_context": job.request_context if isinstance(job.request_context, dict) else {},
        "result_summary": {
            key: value
            for key, value in result_summary.items()
            if key not in {"latest_screenshot_data_url"}
        },
        "events": [
            {
                "at": event.at.isoformat(),
                "event": event.event,
                "level": event.level,
                "message": event.message,
                "url": event.url,
                "status": event.status,
                "payload": event.payload,
            }
            for event in events[:8]
        ],
    }


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
