from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import (
    LocalEvent,
    OccupancySignal,
    PmsConnection,
    PmsConnectionStatus,
    PricingExperiment,
    PricingPerformanceEvent,
    Property,
    RatePush,
)
from app.db.session import get_db
from app.deps import RequestContext, get_request_context
from app.schemas import (
    LocalEventCreate,
    LocalEventResponse,
    OccupancySignalCreate,
    OccupancySignalResponse,
    PricingExperimentCreate,
    PricingExperimentResponse,
    PricingExperimentResultsResponse,
    PricingPerformanceCreate,
    PricingPerformanceResponse,
    PricingPushRequest,
    PricingPushResponse,
    PricingRecommendationResponse,
    PricingRunRequest,
    PricingRunResponse,
)
from app.services.pricing_engine import experiment_results, generate_recommendations
from app.services.usage import UsageLimitExceeded, require_usage_allowance
from app.workers.tasks import push_rate_to_pms

router = APIRouter(tags=["pricing"])


@router.post("/pricing/events", response_model=LocalEventResponse, status_code=201)
def create_local_event(
    payload: LocalEventCreate,
    db: Session = Depends(get_db),
    context: RequestContext = Depends(get_request_context),
) -> LocalEventResponse:
    if payload.property_id is not None:
        _get_property(db, payload.property_id, context.organization_id)
    if payload.ends_on < payload.starts_on:
        raise HTTPException(status_code=400, detail="ends_on must be on or after starts_on")
    event = LocalEvent(
        organization_id=context.organization_id,
        property_id=payload.property_id,
        name=payload.name,
        category=payload.category,
        starts_on=payload.starts_on,
        ends_on=payload.ends_on,
        distance_km=payload.distance_km,
        demand_score=payload.demand_score,
        source=payload.source,
        metadata_=payload.metadata,
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return LocalEventResponse(
        id=event.id,
        name=event.name,
        starts_on=event.starts_on,
        ends_on=event.ends_on,
        demand_score=float(event.demand_score),
    )


@router.post("/pricing/occupancy-signals", response_model=OccupancySignalResponse, status_code=201)
def create_occupancy_signal(
    payload: OccupancySignalCreate,
    db: Session = Depends(get_db),
    context: RequestContext = Depends(get_request_context),
) -> OccupancySignalResponse:
    _get_property(db, payload.property_id, context.organization_id)
    signal = OccupancySignal(
        property_id=payload.property_id,
        stay_date=payload.stay_date,
        property_occupancy=payload.property_occupancy,
        market_occupancy=payload.market_occupancy,
        pacing_ratio=payload.pacing_ratio,
        pickup_7d=payload.pickup_7d,
        pickup_30d=payload.pickup_30d,
        source=payload.source,
        metadata_=payload.metadata,
    )
    db.add(signal)
    db.commit()
    db.refresh(signal)
    return OccupancySignalResponse(
        id=signal.id,
        property_id=signal.property_id,
        stay_date=signal.stay_date,
        property_occupancy=float(signal.property_occupancy) if signal.property_occupancy is not None else None,
        market_occupancy=float(signal.market_occupancy) if signal.market_occupancy is not None else None,
        pacing_ratio=float(signal.pacing_ratio) if signal.pacing_ratio is not None else None,
    )


@router.post("/pricing/recommendations/run", response_model=PricingRunResponse, status_code=201)
def run_recommendations(
    payload: PricingRunRequest,
    db: Session = Depends(get_db),
    context: RequestContext = Depends(get_request_context),
) -> PricingRunResponse:
    rental = _get_property(db, payload.property_id, context.organization_id)
    try:
        require_usage_allowance(db, context.organization_id, "pricing_run", property_id=rental.id)
    except UsageLimitExceeded as exc:
        raise HTTPException(status_code=429, detail=str(exc)) from exc
    recommendations = generate_recommendations(
        db,
        property_id=rental.id,
        start_date=payload.start_date,
        end_date=payload.end_date,
    )
    return PricingRunResponse(
        property_id=rental.id,
        recommendation_count=len(recommendations),
        recommendations=[
            PricingRecommendationResponse(
                id=row.id,
                stay_date=row.stay_date,
                current_rate_cents=row.current_rate_cents,
                recommended_rate_cents=row.recommended_rate_cents,
                recommended_min_stay=row.recommended_min_stay,
                discount_percent=float(row.discount_percent) if row.discount_percent is not None else None,
                confidence=float(row.confidence) if row.confidence is not None else None,
                status=row.status.value,
                reason=row.reason,
            )
            for row in recommendations
        ],
    )


@router.post("/pricing/experiments", response_model=PricingExperimentResponse, status_code=201)
def create_experiment(
    payload: PricingExperimentCreate,
    db: Session = Depends(get_db),
    context: RequestContext = Depends(get_request_context),
) -> PricingExperimentResponse:
    if payload.property_id is not None:
        _get_property(db, payload.property_id, context.organization_id)
    experiment = PricingExperiment(
        organization_id=context.organization_id,
        property_id=payload.property_id,
        name=payload.name,
        status=payload.status,
        hypothesis=payload.hypothesis,
        variants=payload.variants,
        traffic_split=payload.traffic_split,
        primary_metric=payload.primary_metric,
    )
    db.add(experiment)
    db.commit()
    db.refresh(experiment)
    return PricingExperimentResponse(
        id=experiment.id,
        property_id=experiment.property_id,
        name=experiment.name,
        status=experiment.status,
        variants=experiment.variants,
        traffic_split=experiment.traffic_split,
    )


@router.get("/pricing/experiments/{experiment_id}/results", response_model=PricingExperimentResultsResponse)
def get_experiment_results(
    experiment_id: UUID,
    db: Session = Depends(get_db),
    context: RequestContext = Depends(get_request_context),
) -> PricingExperimentResultsResponse:
    experiment = db.scalar(
        select(PricingExperiment)
        .where(PricingExperiment.id == experiment_id)
        .where(PricingExperiment.organization_id == context.organization_id)
    )
    if experiment is None:
        raise HTTPException(status_code=404, detail="Experiment not found")
    results = experiment_results(db, experiment_id)
    return PricingExperimentResultsResponse(**results)


@router.post("/pricing/performance", response_model=PricingPerformanceResponse, status_code=201)
def record_performance(
    payload: PricingPerformanceCreate,
    db: Session = Depends(get_db),
    context: RequestContext = Depends(get_request_context),
) -> PricingPerformanceResponse:
    _get_property(db, payload.property_id, context.organization_id)
    event = PricingPerformanceEvent(
        property_id=payload.property_id,
        pricing_recommendation_id=payload.pricing_recommendation_id,
        experiment_assignment_id=payload.experiment_assignment_id,
        stay_date=payload.stay_date,
        booked=payload.booked,
        booked_at=payload.booked_at,
        realized_rate_cents=payload.realized_rate_cents,
        revenue_cents=payload.revenue_cents,
        occupancy_status=payload.occupancy_status,
        channel=payload.channel,
        metadata_=payload.metadata,
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return PricingPerformanceResponse(
        id=event.id,
        property_id=event.property_id,
        stay_date=event.stay_date,
        booked=event.booked,
        revenue_cents=event.revenue_cents,
    )


@router.post("/pricing/push", response_model=PricingPushResponse, status_code=202)
def push_pricing(
    payload: PricingPushRequest,
    db: Session = Depends(get_db),
    context: RequestContext = Depends(get_request_context),
) -> PricingPushResponse:
    rental = _get_property(db, payload.property_id, context.organization_id)

    connections = _resolve_connections(db, context.organization_id, payload.pms_connection_id)
    if not connections:
        raise HTTPException(status_code=400, detail="No connected PMS/channel connection found")
    try:
        require_usage_allowance(
            db,
            context.organization_id,
            "rate_push",
            property_id=rental.id,
            units=max(1, len(connections) * len(payload.rates)) * 4,
        )
    except UsageLimitExceeded as exc:
        raise HTTPException(status_code=429, detail=str(exc)) from exc

    rate_pushes: list[RatePush] = []
    for connection in connections:
        for item in payload.rates:
            rate_push = RatePush(
                property_id=payload.property_id,
                pms_connection_id=connection.id,
                pricing_recommendation_id=item.pricing_recommendation_id,
                stay_date=item.stay_date,
                currency_code=rental.currency_code,
                rate_cents=item.rate_cents,
                status="queued",
                external_response={"channels": payload.channels},
            )
            db.add(rate_push)
            rate_pushes.append(rate_push)

    db.commit()
    for rate_push in rate_pushes:
        db.refresh(rate_push)

    task_ids: list[str] = []
    for rate_push in rate_pushes:
        async_result = push_rate_to_pms.delay(str(rate_push.id))
        task_ids.append(async_result.id)

    return PricingPushResponse(
        queued_push_ids=[rate_push.id for rate_push in rate_pushes],
        task_id=",".join(task_ids),
    )


def _resolve_connections(
    db: Session,
    organization_id: UUID,
    pms_connection_id: UUID | None,
) -> list[PmsConnection]:
    query = select(PmsConnection).where(PmsConnection.organization_id == organization_id)
    if pms_connection_id:
        query = query.where(PmsConnection.id == pms_connection_id)
    query = query.where(PmsConnection.status == PmsConnectionStatus.connected)
    return list(db.scalars(query).all())


def _get_property(db: Session, property_id: UUID, organization_id: UUID) -> Property:
    rental = db.scalar(
        select(Property)
        .where(Property.id == property_id)
        .where(Property.organization_id == organization_id)
    )
    if rental is None:
        raise HTTPException(status_code=404, detail="Property not found")
    return rental
