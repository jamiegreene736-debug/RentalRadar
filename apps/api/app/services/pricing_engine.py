from __future__ import annotations

import hashlib
import math
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, timedelta
from statistics import median
from uuid import UUID

from sqlalchemy import and_, select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db.models import (
    LocalEvent,
    OccupancySignal,
    PricingExperiment,
    PricingExperimentAssignment,
    PricingPerformanceEvent,
    PricingRecommendation,
    PricingRecommendationStatus,
    Property,
    RateObservation,
)
from app.services.market_booked_data import MarketBookedRateSignal, fetch_market_booked_rate_signals


MODEL_VERSION = "rentalradar-live-demand-v2"


@dataclass(frozen=True)
class MarketMetrics:
    stay_date: date
    comp_median_cents: int | None
    comp_p25_cents: int | None
    comp_p75_cents: int | None
    available_ratio: float | None
    source_count: int
    sample_size: int
    avg_extraction_confidence: float


@dataclass(frozen=True)
class PricingDecision:
    stay_date: date
    recommended_rate_cents: int
    recommended_min_stay: int
    discount_percent: float
    confidence: float
    explanation: dict


class PricingLLMAdvisor:
    """LLM advisory seam for qualitative demand reasoning.

    The default implementation is deterministic so workers can run without an
    LLM key. A production adapter can call the configured LLM with the same
    compact context and return `rate_bias`, `confidence_bias`, and text notes.
    """

    def advise(self, context: dict) -> dict:
        event_strength = context["signals"]["event_strength"]
        market_compression = context["signals"]["market_compression"]
        live_data_quality = context["signals"]["live_data_quality"]
        risk_flags: list[str] = []
        rate_bias = 0.0
        confidence_bias = 0.0

        if event_strength >= 0.75:
            rate_bias += 0.03
        if market_compression >= 0.80:
            rate_bias += 0.025
        if live_data_quality < 0.45:
            confidence_bias -= 0.08
            risk_flags.append("live data sample is thin")
        if context["signals"]["lead_time_days"] <= 5 and market_compression < 0.55:
            rate_bias -= 0.04
            risk_flags.append("near-term demand is soft")

        return {
            "rate_bias": rate_bias,
            "confidence_bias": confidence_bias,
            "summary": _summary_from_context(context),
            "risk_flags": risk_flags,
            "provider": get_settings().llm_provider,
        }


class RentalRadarPricingEngine:
    def __init__(self, advisor: PricingLLMAdvisor | None = None) -> None:
        self.advisor = advisor or PricingLLMAdvisor()

    def recommend(
        self,
        rental: Property,
        market_observations: list[RateObservation],
        events: list[LocalEvent],
        occupancy_signals: list[OccupancySignal],
        performance_events: list[PricingPerformanceEvent],
        start_date: date,
        end_date: date,
        market_booked_signals: list[MarketBookedRateSignal] | None = None,
        market_booked_status: dict | None = None,
    ) -> list[PricingDecision]:
        market_by_date = _market_metrics_by_date(market_observations)
        events_by_date = _events_by_date(events)
        occupancy_by_date = _latest_occupancy_by_date(occupancy_signals)
        booked_signals = market_booked_signals or []
        performance = _performance_summary(performance_events)

        decisions: list[PricingDecision] = []
        current = start_date
        while current <= end_date:
            market = market_by_date.get(current, _empty_market(current))
            occupancy = occupancy_by_date.get(current)
            market_booked = _market_booked_signal_for_date(booked_signals, current)
            day_events = events_by_date.get(current, [])
            lead_time_days = max(0, (current - date.today()).days)

            baseline = _baseline_rate_cents(rental, market, market_booked)
            multipliers = _multipliers(
                current,
                lead_time_days,
                market,
                occupancy,
                day_events,
                performance,
                market_booked,
            )
            pre_ai_rate = int(baseline * math.prod(multipliers.values()))

            context = _decision_context(
                rental=rental,
                stay_date=current,
                baseline_cents=baseline,
                pre_ai_rate_cents=pre_ai_rate,
                market=market,
                occupancy=occupancy,
                market_booked=market_booked,
                market_booked_status=market_booked_status,
                events=day_events,
                multipliers=multipliers,
                lead_time_days=lead_time_days,
                performance=performance,
            )
            ai_advice = self.advisor.advise(context)
            recommended = int(pre_ai_rate * (1 + ai_advice["rate_bias"]))
            recommended = _clamp_rate(recommended, rental.min_price_cents, rental.max_price_cents)

            min_stay = _recommended_min_stay(current, lead_time_days, market, occupancy, day_events)
            discount = _discount_percent(lead_time_days, market, occupancy)
            confidence = (
                _confidence_score(market, occupancy, day_events, performance)
                + ai_advice["confidence_bias"]
            )
            if market_booked:
                confidence += min(0.08, market_booked.confidence * 0.08)
            confidence = max(0.05, min(0.98, confidence))

            explanation = context | {
                "ai_advice": ai_advice,
                "recommendation": {
                    "rate_cents": recommended,
                    "min_stay": min_stay,
                    "discount_percent": discount,
                    "confidence": round(confidence, 4),
                },
                "competitive_logic": _competitive_comparison(
                    rental=rental,
                    stay_date=current,
                    market=market,
                    occupancy=occupancy,
                    market_booked=market_booked,
                    events=day_events,
                    rentalradar_rate_cents=recommended,
                ),
            }
            decisions.append(
                PricingDecision(
                    stay_date=current,
                    recommended_rate_cents=recommended,
                    recommended_min_stay=min_stay,
                    discount_percent=discount,
                    confidence=round(confidence, 4),
                    explanation=explanation,
                )
            )
            current += timedelta(days=1)
        return decisions


def generate_recommendations(
    db: Session,
    property_id: UUID,
    start_date: date | None = None,
    end_date: date | None = None,
) -> list[PricingRecommendation]:
    rental = db.scalar(select(Property).where(Property.id == property_id))
    if rental is None:
        return []

    start = start_date or date.today()
    end = end_date or start + timedelta(days=90)

    observations = list(
        db.scalars(
            select(RateObservation)
            .where(RateObservation.property_id == property_id)
            .where(RateObservation.stay_date >= start)
            .where(RateObservation.stay_date <= end)
            .order_by(RateObservation.stay_date.asc(), RateObservation.observed_at.desc())
        ).all()
    )
    events = list(
        db.scalars(
            select(LocalEvent)
            .where(LocalEvent.organization_id == rental.organization_id)
            .where(LocalEvent.starts_on <= end)
            .where(LocalEvent.ends_on >= start)
            .where((LocalEvent.property_id.is_(None)) | (LocalEvent.property_id == property_id))
        ).all()
    )
    occupancy = list(
        db.scalars(
            select(OccupancySignal)
            .where(OccupancySignal.property_id == property_id)
            .where(OccupancySignal.stay_date >= start)
            .where(OccupancySignal.stay_date <= end)
            .order_by(OccupancySignal.stay_date.asc(), OccupancySignal.observed_at.desc())
        ).all()
    )
    performance = list(
        db.scalars(
            select(PricingPerformanceEvent)
            .where(PricingPerformanceEvent.property_id == property_id)
            .where(PricingPerformanceEvent.stay_date >= start - timedelta(days=365))
            .where(PricingPerformanceEvent.stay_date <= start - timedelta(days=1))
        ).all()
    )
    market_booked_result = fetch_market_booked_rate_signals(rental, start, end)

    decisions = RentalRadarPricingEngine().recommend(
        rental=rental,
        market_observations=observations,
        events=events,
        occupancy_signals=occupancy,
        performance_events=performance,
        start_date=start,
        end_date=end,
        market_booked_signals=market_booked_result.signals,
        market_booked_status={
            "provider": market_booked_result.provider,
            "status": market_booked_result.status,
            "message": market_booked_result.message,
        },
    )

    old_recommendations = list(
        db.scalars(
            select(PricingRecommendation)
            .where(PricingRecommendation.property_id == property_id)
            .where(PricingRecommendation.stay_date >= start)
            .where(PricingRecommendation.stay_date <= end)
            .where(
                PricingRecommendation.status.in_(
                    [
                        PricingRecommendationStatus.draft,
                        PricingRecommendationStatus.pending_approval,
                        PricingRecommendationStatus.approved,
                        PricingRecommendationStatus.pushed,
                    ]
                )
            )
        ).all()
    )
    for old in old_recommendations:
        old.status = PricingRecommendationStatus.superseded
    db.flush()

    recommendations: list[PricingRecommendation] = []
    for decision in decisions:
        rec = PricingRecommendation(
            property_id=property_id,
            stay_date=decision.stay_date,
            currency_code=rental.currency_code,
            current_rate_cents=rental.base_price_cents,
            recommended_rate_cents=decision.recommended_rate_cents,
            min_rate_cents=rental.min_price_cents,
            max_rate_cents=rental.max_price_cents,
            confidence=decision.confidence,
            recommended_min_stay=decision.recommended_min_stay,
            discount_percent=decision.discount_percent,
            status=PricingRecommendationStatus.pending_approval,
            model_version=MODEL_VERSION,
            reason=decision.explanation,
        )
        db.add(rec)
        recommendations.append(rec)
    db.flush()
    assign_active_experiments(db, rental, recommendations)
    db.commit()
    try:
        from app.services.direct_ota import queue_direct_push_after_recalculation

        queue_direct_push_after_recalculation(db, property_id, recommendations)
    except Exception:
        # Direct OTA mode is an optional high-risk add-on; pricing generation
        # must remain successful even if its queue path is unavailable.
        pass
    return recommendations


def assign_active_experiments(
    db: Session,
    rental: Property,
    recommendations: list[PricingRecommendation],
) -> list[PricingExperimentAssignment]:
    experiments = list(
        db.scalars(
            select(PricingExperiment)
            .where(PricingExperiment.organization_id == rental.organization_id)
            .where(PricingExperiment.status == "running")
            .where(
                (PricingExperiment.property_id.is_(None))
                | (PricingExperiment.property_id == rental.id)
            )
        ).all()
    )
    assignments: list[PricingExperimentAssignment] = []
    for experiment in experiments:
        variants = experiment.variants or {}
        split = experiment.traffic_split or {}
        if not variants:
            continue
        for rec in recommendations:
            existing = db.scalar(
                select(PricingExperimentAssignment).where(
                    and_(
                        PricingExperimentAssignment.experiment_id == experiment.id,
                        PricingExperimentAssignment.property_id == rental.id,
                        PricingExperimentAssignment.stay_date == rec.stay_date,
                    )
                )
            )
            if existing is not None:
                assignments.append(existing)
                continue
            variant_key = _assign_variant(experiment.id, rental.id, rec.stay_date, split, variants)
            variant = variants.get(variant_key, {})
            rate = int(rec.recommended_rate_cents * float(variant.get("rate_multiplier", 1.0)))
            min_stay = max(
                1, (rec.recommended_min_stay or 1) + int(variant.get("min_stay_delta", 0))
            )
            discount = max(
                0.0,
                min(
                    100.0,
                    float(rec.discount_percent or 0) + float(variant.get("discount_delta", 0)),
                ),
            )
            assignment = PricingExperimentAssignment(
                experiment_id=experiment.id,
                property_id=rental.id,
                pricing_recommendation_id=rec.id,
                stay_date=rec.stay_date,
                variant_key=variant_key,
                assigned_rate_cents=_clamp_rate(
                    rate, rental.min_price_cents, rental.max_price_cents
                ),
                assigned_min_stay=min_stay,
                assigned_discount_percent=round(discount, 2),
                assignment_context={
                    "experiment_name": experiment.name,
                    "base_recommendation_cents": rec.recommended_rate_cents,
                    "variant": variant,
                },
            )
            db.add(assignment)
            assignments.append(assignment)
    return assignments


def experiment_results(db: Session, experiment_id: UUID) -> dict:
    assignments = list(
        db.scalars(
            select(PricingExperimentAssignment).where(
                PricingExperimentAssignment.experiment_id == experiment_id
            )
        ).all()
    )
    if not assignments:
        return {"experiment_id": str(experiment_id), "variants": {}}
    performance = list(
        db.scalars(
            select(PricingPerformanceEvent).where(
                PricingPerformanceEvent.experiment_assignment_id.in_([a.id for a in assignments])
            )
        ).all()
    )
    by_assignment = defaultdict(list)
    for event in performance:
        by_assignment[event.experiment_assignment_id].append(event)

    by_variant: dict[str, dict] = {}
    for assignment in assignments:
        bucket = by_variant.setdefault(
            assignment.variant_key,
            {
                "assigned_nights": 0,
                "booked_nights": 0,
                "revenue_cents": 0,
                "adr_cents": 0,
                "revpar_cents": 0,
            },
        )
        bucket["assigned_nights"] += 1
        events = by_assignment.get(assignment.id, [])
        if any(event.booked for event in events):
            bucket["booked_nights"] += 1
        bucket["revenue_cents"] += sum(event.revenue_cents or 0 for event in events)

    for bucket in by_variant.values():
        booked = bucket["booked_nights"]
        assigned = bucket["assigned_nights"]
        revenue = bucket["revenue_cents"]
        bucket["conversion_rate"] = round(booked / assigned, 4) if assigned else 0
        bucket["adr_cents"] = int(revenue / booked) if booked else 0
        bucket["revpar_cents"] = int(revenue / assigned) if assigned else 0
    return {"experiment_id": str(experiment_id), "variants": by_variant}


def _market_metrics_by_date(observations: list[RateObservation]) -> dict[date, MarketMetrics]:
    grouped: dict[date, list[RateObservation]] = defaultdict(list)
    for row in observations:
        if row.nightly_rate_cents is not None:
            grouped[row.stay_date].append(row)

    metrics: dict[date, MarketMetrics] = {}
    for stay_date, rows in grouped.items():
        rates = sorted(row.nightly_rate_cents for row in rows if row.nightly_rate_cents is not None)
        available = [row.available for row in rows if row.available is not None]
        confidences = [float(row.extraction_confidence or 0.5) for row in rows]
        metrics[stay_date] = MarketMetrics(
            stay_date=stay_date,
            comp_median_cents=int(median(rates)) if rates else None,
            comp_p25_cents=_percentile(rates, 0.25),
            comp_p75_cents=_percentile(rates, 0.75),
            available_ratio=sum(1 for value in available if value) / len(available)
            if available
            else None,
            source_count=len({row.source.value for row in rows}),
            sample_size=len(rates),
            avg_extraction_confidence=sum(confidences) / len(confidences) if confidences else 0,
        )
    return metrics


def _events_by_date(events: list[LocalEvent]) -> dict[date, list[LocalEvent]]:
    grouped: dict[date, list[LocalEvent]] = defaultdict(list)
    for event in events:
        current = event.starts_on
        while current <= event.ends_on:
            grouped[current].append(event)
            current += timedelta(days=1)
    return grouped


def _latest_occupancy_by_date(signals: list[OccupancySignal]) -> dict[date, OccupancySignal]:
    latest: dict[date, OccupancySignal] = {}
    for signal in signals:
        if (
            signal.stay_date not in latest
            or signal.observed_at > latest[signal.stay_date].observed_at
        ):
            latest[signal.stay_date] = signal
    return latest


def _market_booked_signal_for_date(
    signals: list[MarketBookedRateSignal],
    stay_date: date,
) -> MarketBookedRateSignal | None:
    for signal in signals:
        if signal.start_date <= stay_date <= signal.end_date:
            return signal
    return signals[0] if signals else None


def _performance_summary(events: list[PricingPerformanceEvent]) -> dict:
    nights = len(events)
    booked = sum(1 for event in events if event.booked)
    revenue = sum(event.revenue_cents or 0 for event in events)
    return {
        "nights": nights,
        "booked_nights": booked,
        "conversion_rate": booked / nights if nights else None,
        "adr_cents": int(revenue / booked) if booked else None,
        "revpar_cents": int(revenue / nights) if nights else None,
    }


def _empty_market(stay_date: date) -> MarketMetrics:
    return MarketMetrics(
        stay_date=stay_date,
        comp_median_cents=None,
        comp_p25_cents=None,
        comp_p75_cents=None,
        available_ratio=None,
        source_count=0,
        sample_size=0,
        avg_extraction_confidence=0,
    )


def _baseline_rate_cents(
    rental: Property,
    market: MarketMetrics,
    market_booked: MarketBookedRateSignal | None,
) -> int:
    booked_rate = _booked_rate_cents(market_booked)
    if market.comp_median_cents and booked_rate:
        return int(market.comp_median_cents * 0.65 + booked_rate * 0.35)
    if booked_rate:
        return booked_rate
    if market.comp_median_cents:
        return market.comp_median_cents
    if rental.base_price_cents:
        return rental.base_price_cents
    if rental.min_price_cents and rental.max_price_cents:
        return int((rental.min_price_cents + rental.max_price_cents) / 2)
    return 17500


def _booked_rate_cents(signal: MarketBookedRateSignal | None) -> int | None:
    if signal is None:
        return None
    return signal.median_booked_rate_cents or signal.average_booked_rate_cents


def _multipliers(
    stay_date: date,
    lead_time_days: int,
    market: MarketMetrics,
    occupancy: OccupancySignal | None,
    events: list[LocalEvent],
    performance: dict,
    market_booked: MarketBookedRateSignal | None,
) -> dict[str, float]:
    month = stay_date.month
    seasonal = {
        1: 0.88,
        2: 0.94,
        3: 1.02,
        4: 1.06,
        5: 1.08,
        6: 1.16,
        7: 1.22,
        8: 1.17,
        9: 1.02,
        10: 0.98,
        11: 0.92,
        12: 1.10,
    }[month]
    dow = 1.14 if stay_date.weekday() in (4, 5) else 1.04 if stay_date.weekday() == 6 else 0.97
    lead = (
        0.92
        if lead_time_days <= 3
        else 0.96
        if lead_time_days <= 7
        else 1.03
        if lead_time_days >= 90
        else 1.0
    )
    compression = 1.0
    if market.available_ratio is not None:
        compression = (
            1.18
            if market.available_ratio < 0.25
            else 1.09
            if market.available_ratio < 0.45
            else 0.94
            if market.available_ratio > 0.85
            else 1.0
        )
    event = 1 + min(0.28, max((float(e.demand_score) for e in events), default=0) * 0.28)
    occ = 1.0
    if occupancy:
        market_occ = float(occupancy.market_occupancy or 0)
        pacing = float(occupancy.pacing_ratio or 1)
        occ += (
            0.12
            if market_occ >= 0.85
            else 0.06
            if market_occ >= 0.72
            else -0.05
            if market_occ <= 0.45
            else 0
        )
        occ += 0.04 if pacing >= 1.15 else -0.04 if pacing <= 0.85 else 0
    if market_booked and market_booked.occupancy is not None:
        occ += (
            0.06
            if market_booked.occupancy >= 0.78
            else -0.04
            if market_booked.occupancy <= 0.42
            else 0
        )
    historical = 1.0
    conversion = performance.get("conversion_rate")
    if conversion is not None:
        historical = 1.04 if conversion >= 0.72 else 0.97 if conversion <= 0.35 else 1.0
    return {
        "seasonality": seasonal,
        "day_of_week": dow,
        "lead_time": lead,
        "live_market_compression": compression,
        "local_events": event,
        "occupancy_pacing": occ,
        "historical_performance": historical,
    }


def _decision_context(
    rental: Property,
    stay_date: date,
    baseline_cents: int,
    pre_ai_rate_cents: int,
    market: MarketMetrics,
    occupancy: OccupancySignal | None,
    market_booked: MarketBookedRateSignal | None,
    market_booked_status: dict | None,
    events: list[LocalEvent],
    multipliers: dict[str, float],
    lead_time_days: int,
    performance: dict,
) -> dict:
    event_strength = max((float(event.demand_score) for event in events), default=0)
    compression = 1 - market.available_ratio if market.available_ratio is not None else 0.5
    live_quality = min(
        1.0, (market.sample_size / 12) * 0.7 + market.avg_extraction_confidence * 0.3
    )
    booked_rate = _booked_rate_cents(market_booked)
    return {
        "property": {
            "id": str(rental.id),
            "base_price_cents": rental.base_price_cents,
            "min_price_cents": rental.min_price_cents,
            "max_price_cents": rental.max_price_cents,
            "bedrooms": rental.bedrooms,
            "sleeps": rental.sleeps,
        },
        "stay_date": stay_date.isoformat(),
        "baseline_rate_cents": baseline_cents,
        "pre_ai_rate_cents": pre_ai_rate_cents,
        "market": {
            "comp_median_cents": market.comp_median_cents,
            "comp_p25_cents": market.comp_p25_cents,
            "comp_p75_cents": market.comp_p75_cents,
            "available_ratio": market.available_ratio,
            "source_count": market.source_count,
            "sample_size": market.sample_size,
            "avg_extraction_confidence": round(market.avg_extraction_confidence, 4),
        },
        "events": [
            {
                "name": event.name,
                "category": event.category,
                "demand_score": float(event.demand_score),
                "distance_km": float(event.distance_km) if event.distance_km is not None else None,
            }
            for event in events
        ],
        "occupancy": {
            "property_occupancy": float(occupancy.property_occupancy)
            if occupancy and occupancy.property_occupancy is not None
            else None,
            "market_occupancy": float(occupancy.market_occupancy)
            if occupancy and occupancy.market_occupancy is not None
            else None,
            "pacing_ratio": float(occupancy.pacing_ratio)
            if occupancy and occupancy.pacing_ratio is not None
            else None,
            "pickup_7d": occupancy.pickup_7d if occupancy else None,
        },
        "market_booked_rate": {
            "source": market_booked.source
            if market_booked
            else market_booked_status.get("provider")
            if market_booked_status
            else None,
            "status": market_booked_status.get("status")
            if market_booked_status
            else "not_requested",
            "message": market_booked_status.get("message") if market_booked_status else None,
            "average_booked_rate_cents": market_booked.average_booked_rate_cents
            if market_booked
            else None,
            "median_booked_rate_cents": market_booked.median_booked_rate_cents
            if market_booked
            else None,
            "booked_rate_cents": booked_rate,
            "market_occupancy": market_booked.occupancy if market_booked else None,
            "revpar_cents": market_booked.revpar_cents if market_booked else None,
            "sample_size": market_booked.sample_size if market_booked else 0,
            "confidence": market_booked.confidence if market_booked else 0,
        },
        "multipliers": {key: round(value, 4) for key, value in multipliers.items()},
        "signals": {
            "event_strength": round(event_strength, 4),
            "market_compression": round(compression, 4),
            "live_data_quality": round(live_quality, 4),
            "lead_time_days": lead_time_days,
        },
        "historical_performance": performance,
    }


def _competitive_comparison(
    rental: Property,
    stay_date: date,
    market: MarketMetrics,
    occupancy: OccupancySignal | None,
    market_booked: MarketBookedRateSignal | None,
    events: list[LocalEvent],
    rentalradar_rate_cents: int,
) -> dict:
    base = rental.base_price_cents or market.comp_median_cents or rentalradar_rate_cents
    calendar_benchmark = int(base * (1.12 if stay_date.weekday() in (4, 5) else 1.0))
    if events:
        calendar_benchmark = int(calendar_benchmark * 1.08)
    comp_blend = market.comp_median_cents or base
    booked_rate = _booked_rate_cents(market_booked)
    if booked_rate and market.comp_median_cents:
        comp_blend = int(market.comp_median_cents * 0.6 + booked_rate * 0.4)
    elif booked_rate:
        comp_blend = booked_rate
    if occupancy and occupancy.market_occupancy is not None:
        comp_blend = int(comp_blend * (1 + (float(occupancy.market_occupancy) - 0.65) * 0.25))
    return {
        "calendar_benchmark_rate_cents": calendar_benchmark,
        "comp_blend_rate_cents": comp_blend,
        "market_paid_rate_cents": booked_rate,
        "market_paid_source": market_booked.source if market_booked else None,
        "rentalradar_live_rate_cents": rentalradar_rate_cents,
        "advantage": "RentalRadar weights fresh guest-visible rates, market booked-rate evidence, PMS pacing, source confidence, and event strength in the same decision rather than relying on one data source.",
    }


def _recommended_min_stay(
    stay_date: date,
    lead_time_days: int,
    market: MarketMetrics,
    occupancy: OccupancySignal | None,
    events: list[LocalEvent],
) -> int:
    if events and max(float(event.demand_score) for event in events) >= 0.75:
        return 3
    if stay_date.weekday() in (4, 5):
        return 2
    if lead_time_days <= 5:
        return 1
    if (
        occupancy
        and occupancy.market_occupancy is not None
        and float(occupancy.market_occupancy) >= 0.85
    ):
        return 2
    if market.available_ratio is not None and market.available_ratio < 0.3:
        return 2
    return 1


def _discount_percent(
    lead_time_days: int,
    market: MarketMetrics,
    occupancy: OccupancySignal | None,
) -> float:
    soft_market = market.available_ratio is not None and market.available_ratio > 0.75
    weak_occ = (
        occupancy
        and occupancy.market_occupancy is not None
        and float(occupancy.market_occupancy) < 0.45
    )
    if lead_time_days <= 3 and (soft_market or weak_occ):
        return 15.0
    if lead_time_days <= 7 and (soft_market or weak_occ):
        return 10.0
    if (
        lead_time_days >= 45
        and market.available_ratio is not None
        and market.available_ratio < 0.35
    ):
        return 0.0
    return 5.0 if soft_market else 0.0


def _confidence_score(
    market: MarketMetrics,
    occupancy: OccupancySignal | None,
    events: list[LocalEvent],
    performance: dict,
) -> float:
    market_score = min(0.42, market.sample_size * 0.025 + market.source_count * 0.05)
    extraction_score = market.avg_extraction_confidence * 0.22
    occupancy_score = 0.16 if occupancy else 0
    event_score = 0.08 if events else 0
    performance_score = (
        0.10 if performance.get("nights", 0) >= 20 else 0.03 if performance.get("nights", 0) else 0
    )
    return (
        0.18 + market_score + extraction_score + occupancy_score + event_score + performance_score
    )


def _assign_variant(
    experiment_id: UUID,
    property_id: UUID,
    stay_date: date,
    split: dict,
    variants: dict,
) -> str:
    if not split:
        split = {key: 1 / len(variants) for key in variants}
    score = int(
        hashlib.sha256(f"{experiment_id}:{property_id}:{stay_date}".encode()).hexdigest()[:8], 16
    )
    bucket = score / 0xFFFFFFFF
    cumulative = 0.0
    for key, weight in split.items():
        cumulative += float(weight)
        if bucket <= cumulative:
            return key
    return next(iter(variants))


def _clamp_rate(rate_cents: int, min_rate_cents: int | None, max_rate_cents: int | None) -> int:
    if min_rate_cents is not None:
        rate_cents = max(rate_cents, min_rate_cents)
    if max_rate_cents is not None:
        rate_cents = min(rate_cents, max_rate_cents)
    return rate_cents


def _percentile(values: list[int], percentile: float) -> int | None:
    if not values:
        return None
    index = min(len(values) - 1, max(0, round((len(values) - 1) * percentile)))
    return values[index]


def _summary_from_context(context: dict) -> str:
    market = context["market"]
    signals = context["signals"]
    if market["sample_size"] == 0:
        return "Limited live comp data, so the recommendation leans on property bounds, seasonality, and pacing signals."
    if signals["event_strength"] >= 0.75:
        return "Strong event demand and live market compression support a premium over static calendar pricing."
    if signals["market_compression"] >= 0.70:
        return "Fresh scraped availability shows compressed supply, supporting a higher live-market rate."
    if signals["lead_time_days"] <= 7:
        return (
            "Near-term pricing balances booking urgency against current live-market availability."
        )
    return "Live comp rates, seasonality, and occupancy pacing are aligned enough for a steady optimized rate."
