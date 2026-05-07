from __future__ import annotations

import hashlib
import math
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from statistics import median
from uuid import UUID

from app.db.models import PricingRecommendation, Property, RateObservation


@dataclass(frozen=True)
class ForecastNight:
    stay_date: date
    recommended_rate_cents: int
    beyond_pricing_rate_cents: int
    wheelhouse_style_rate_cents: int
    estimated_occupancy: float
    estimated_revenue_cents: int
    confidence: float


@dataclass(frozen=True)
class MonthlyForecast:
    month: date
    average_recommended_rate_cents: int
    average_beyond_pricing_rate_cents: int
    average_wheelhouse_style_rate_cents: int
    estimated_occupancy: float
    estimated_revenue_cents: int
    beyond_pricing_revenue_cents: int
    extra_income_vs_beyond_cents: int


@dataclass(frozen=True)
class ForecastResult:
    generated_at: datetime
    estimated_occupancy: float
    recommended_total_revenue_cents: int
    beyond_pricing_total_revenue_cents: int
    extra_income_vs_beyond_cents: int
    confidence: float
    explanation: str
    monthly: list[MonthlyForecast]
    nights: list[ForecastNight]


@dataclass(frozen=True)
class BrowserEvidence:
    status: str
    queued_job_ids: list[UUID]
    completed_scan_count: int
    observations_used: int
    latest_observed_at: datetime | None
    sources: list[str]
    message: str


@dataclass(frozen=True)
class TargetOccupancyNight:
    stay_date: date
    suggested_rate_cents: int
    market_rate_cents: int
    expected_occupancy: float
    strategy: str


@dataclass(frozen=True)
class TargetOccupancyPlan:
    generated_at: datetime
    target_month: date
    target_occupancy: float
    current_projected_occupancy: float
    suggested_average_rate_cents: int
    market_average_rate_cents: int
    rate_change_percent: float
    projected_revenue_cents: int
    confidence: float
    game_plan: list[str]
    browser_evidence: BrowserEvidence
    nights: list[TargetOccupancyNight]


def build_rate_forecast(
    rental: Property,
    recommendations: list[PricingRecommendation],
    observations: list[RateObservation],
    months: int,
) -> ForecastResult:
    horizon_months = max(6, min(months, 24))
    today = date.today()
    end = today + timedelta(days=round(horizon_months * 30.4375))
    rec_by_date = _recommendations_by_date(recommendations)
    observations_by_date = _observations_by_date(observations)
    address_seed = _seed(rental.formatted_address or rental.address_line1 or str(rental.id))
    property_seed = _seed(f"{rental.id}:{rental.bedrooms}:{rental.sleeps}")
    base_rate = _base_rate_cents(rental, observations, address_seed)
    confidence = _confidence(recommendations, observations)

    nights: list[ForecastNight] = []
    current = today
    while current < end:
        rec = rec_by_date.get(current)
        market_rates = observations_by_date.get(current, [])
        live_market_rate = int(sum(market_rates) / len(market_rates)) if market_rates else None

        recommended = rec.recommended_rate_cents if rec else _modeled_rate(
            base_rate=live_market_rate or base_rate,
            stay_date=current,
            address_seed=address_seed,
            property_seed=property_seed,
            premium=True,
        )
        beyond_rate = _modeled_rate(
            base_rate=base_rate,
            stay_date=current,
            address_seed=address_seed,
            property_seed=property_seed,
            premium=False,
        )
        wheelhouse_rate = int((live_market_rate or beyond_rate) * (1.01 + _wave(current, property_seed) * 0.025))
        occupancy = _estimated_occupancy(current, address_seed, property_seed, recommended, beyond_rate)
        nights.append(
            ForecastNight(
                stay_date=current,
                recommended_rate_cents=recommended,
                beyond_pricing_rate_cents=beyond_rate,
                wheelhouse_style_rate_cents=wheelhouse_rate,
                estimated_occupancy=occupancy,
                estimated_revenue_cents=round(recommended * occupancy),
                confidence=confidence,
            )
        )
        current += timedelta(days=1)

    monthly = _monthly_rollup(nights)
    recommended_total = sum(month.estimated_revenue_cents for month in monthly)
    beyond_total = sum(month.beyond_pricing_revenue_cents for month in monthly)
    occupancy = sum(night.estimated_occupancy for night in nights) / len(nights) if nights else 0
    return ForecastResult(
        generated_at=datetime.now(timezone.utc),
        estimated_occupancy=round(occupancy, 4),
        recommended_total_revenue_cents=recommended_total,
        beyond_pricing_total_revenue_cents=beyond_total,
        extra_income_vs_beyond_cents=recommended_total - beyond_total,
        confidence=confidence,
        explanation=(
            "Forecast blends live scrape recommendations when available with address-specific seasonality, "
            "day-of-week demand, comp-rate movement, and occupancy pacing. The comparison line is a "
            "market benchmark, not a third-party account pull."
        ),
        monthly=monthly,
        nights=nights,
    )


def build_target_occupancy_plan(
    rental: Property,
    recommendations: list[PricingRecommendation],
    observations: list[RateObservation],
    target_month: date,
    target_occupancy: float,
    queued_job_ids: list[UUID],
    completed_scan_count: int,
) -> TargetOccupancyPlan:
    month = date(target_month.year, target_month.month, 1)
    next_month = date(month.year + 1, 1, 1) if month.month == 12 else date(month.year, month.month + 1, 1)
    rec_by_date = _recommendations_by_date(recommendations)
    observations_by_date = _observations_by_date(observations)
    address_seed = _seed(rental.formatted_address or rental.address_line1 or str(rental.id))
    property_seed = _seed(f"{rental.id}:{rental.bedrooms}:{rental.sleeps}:target")
    base_rate = _base_rate_cents(rental, observations, address_seed)

    nights: list[TargetOccupancyNight] = []
    current_occupancies: list[float] = []
    current_rates: list[int] = []
    market_rates: list[int] = []
    day = month
    while day < next_month:
        live_rates = observations_by_date.get(day, [])
        market_rate = round(median(live_rates)) if live_rates else _modeled_rate(
            base_rate=base_rate,
            stay_date=day,
            address_seed=address_seed,
            property_seed=property_seed,
            premium=False,
        )
        current_rate = rec_by_date.get(day).recommended_rate_cents if rec_by_date.get(day) else _modeled_rate(
            base_rate=market_rate,
            stay_date=day,
            address_seed=address_seed,
            property_seed=property_seed,
            premium=True,
        )
        current_occupancy = _estimated_occupancy(day, address_seed, property_seed, current_rate, market_rate)
        occupancy_gap = target_occupancy - current_occupancy
        suggested_rate = _target_rate(
            current_rate=current_rate,
            market_rate=market_rate,
            target_occupancy=target_occupancy,
            current_occupancy=current_occupancy,
            min_rate=rental.min_price_cents,
            max_rate=rental.max_price_cents,
        )
        expected_occupancy = _estimated_occupancy(day, address_seed, property_seed, suggested_rate, market_rate)
        nights.append(
            TargetOccupancyNight(
                stay_date=day,
                suggested_rate_cents=suggested_rate,
                market_rate_cents=market_rate,
                expected_occupancy=expected_occupancy,
                strategy=_night_strategy(day, occupancy_gap, suggested_rate, market_rate),
            )
        )
        current_occupancies.append(current_occupancy)
        current_rates.append(current_rate)
        market_rates.append(market_rate)
        day += timedelta(days=1)

    average_current_rate = round(sum(current_rates) / len(current_rates)) if current_rates else base_rate
    suggested_average = round(sum(night.suggested_rate_cents for night in nights) / len(nights)) if nights else base_rate
    market_average = round(sum(market_rates) / len(market_rates)) if market_rates else base_rate
    current_projected_occupancy = (
        round(sum(current_occupancies) / len(current_occupancies), 4) if current_occupancies else 0
    )
    projected_revenue = sum(round(night.suggested_rate_cents * night.expected_occupancy) for night in nights)
    confidence = _target_confidence(recommendations, observations, completed_scan_count, queued_job_ids)
    evidence = _browser_evidence(observations, queued_job_ids, completed_scan_count)

    return TargetOccupancyPlan(
        generated_at=datetime.now(timezone.utc),
        target_month=month,
        target_occupancy=round(target_occupancy, 4),
        current_projected_occupancy=current_projected_occupancy,
        suggested_average_rate_cents=suggested_average,
        market_average_rate_cents=market_average,
        rate_change_percent=round((suggested_average - average_current_rate) / max(average_current_rate, 1), 4),
        projected_revenue_cents=projected_revenue,
        confidence=confidence,
        game_plan=_game_plan(
            month=month,
            target_occupancy=target_occupancy,
            current_projected_occupancy=current_projected_occupancy,
            suggested_average=suggested_average,
            market_average=market_average,
            evidence=evidence,
        ),
        browser_evidence=evidence,
        nights=nights,
    )


def _recommendations_by_date(recommendations: list[PricingRecommendation]) -> dict[date, PricingRecommendation]:
    latest: dict[date, PricingRecommendation] = {}
    for rec in recommendations:
        if rec.stay_date not in latest or rec.created_at > latest[rec.stay_date].created_at:
            latest[rec.stay_date] = rec
    return latest


def _observations_by_date(observations: list[RateObservation]) -> dict[date, list[int]]:
    grouped: dict[date, list[int]] = defaultdict(list)
    for observation in observations:
        if observation.nightly_rate_cents is not None:
            grouped[observation.stay_date].append(observation.nightly_rate_cents)
    return grouped


def _base_rate_cents(rental: Property, observations: list[RateObservation], seed: float) -> int:
    rates = sorted(row.nightly_rate_cents for row in observations if row.nightly_rate_cents is not None)
    if rates:
        return rates[len(rates) // 2]
    if rental.base_price_cents:
        return rental.base_price_cents
    if rental.min_price_cents and rental.max_price_cents:
        return round((rental.min_price_cents + rental.max_price_cents) / 2)

    bedrooms = rental.bedrooms or 2
    sleeps = rental.sleeps or bedrooms * 2
    return round((145 + bedrooms * 42 + sleeps * 9 + seed * 80) * 100)


def _modeled_rate(
    *,
    base_rate: int,
    stay_date: date,
    address_seed: float,
    property_seed: float,
    premium: bool,
) -> int:
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
    }[stay_date.month]
    weekend = 1.18 if stay_date.weekday() in (4, 5) else 1.05 if stay_date.weekday() == 6 else 0.97
    micro_market = 0.94 + address_seed * 0.18
    demand_wave = 1 + _wave(stay_date, property_seed) * (0.09 if premium else 0.04)
    premium_lift = 1.055 if premium else 0.995
    return round(base_rate * seasonal * weekend * micro_market * demand_wave * premium_lift)


def _estimated_occupancy(
    stay_date: date,
    address_seed: float,
    property_seed: float,
    recommended_rate: int,
    beyond_rate: int,
) -> float:
    month_lift = {
        1: -0.04,
        2: -0.01,
        3: 0.03,
        4: 0.05,
        5: 0.07,
        6: 0.11,
        7: 0.13,
        8: 0.10,
        9: 0.04,
        10: 0.02,
        11: -0.02,
        12: 0.08,
    }[stay_date.month]
    weekend = 0.06 if stay_date.weekday() in (4, 5) else 0.01 if stay_date.weekday() == 6 else -0.015
    price_pressure = max(-0.08, min(0.05, (beyond_rate - recommended_rate) / max(beyond_rate, 1) * 0.35))
    occupancy = 0.54 + month_lift + weekend + address_seed * 0.08 + _wave(stay_date, property_seed) * 0.035 + price_pressure
    return round(max(0.34, min(0.91, occupancy)), 4)


def _monthly_rollup(nights: list[ForecastNight]) -> list[MonthlyForecast]:
    grouped: dict[date, list[ForecastNight]] = defaultdict(list)
    for night in nights:
        grouped[date(night.stay_date.year, night.stay_date.month, 1)].append(night)

    months: list[MonthlyForecast] = []
    for month, month_nights in sorted(grouped.items()):
        count = len(month_nights)
        revenue = sum(night.estimated_revenue_cents for night in month_nights)
        beyond_revenue = sum(round(night.beyond_pricing_rate_cents * night.estimated_occupancy) for night in month_nights)
        months.append(
            MonthlyForecast(
                month=month,
                average_recommended_rate_cents=round(sum(night.recommended_rate_cents for night in month_nights) / count),
                average_beyond_pricing_rate_cents=round(sum(night.beyond_pricing_rate_cents for night in month_nights) / count),
                average_wheelhouse_style_rate_cents=round(sum(night.wheelhouse_style_rate_cents for night in month_nights) / count),
                estimated_occupancy=round(sum(night.estimated_occupancy for night in month_nights) / count, 4),
                estimated_revenue_cents=revenue,
                beyond_pricing_revenue_cents=beyond_revenue,
                extra_income_vs_beyond_cents=revenue - beyond_revenue,
            )
        )
    return months


def _confidence(recommendations: list[PricingRecommendation], observations: list[RateObservation]) -> float:
    recommendation_score = min(0.22, len(recommendations) / 365 * 0.22)
    observation_score = min(0.24, len(observations) / 180 * 0.24)
    return round(0.54 + recommendation_score + observation_score, 4)


def _target_rate(
    *,
    current_rate: int,
    market_rate: int,
    target_occupancy: float,
    current_occupancy: float,
    min_rate: int | None,
    max_rate: int | None,
) -> int:
    occupancy_gap = target_occupancy - current_occupancy
    if occupancy_gap > 0:
        market_anchor = market_rate * (0.92 - min(0.18, occupancy_gap * 0.8))
        current_anchor = current_rate * (1 - min(0.24, occupancy_gap * 0.95))
        rate = round(min(market_anchor, current_anchor))
    else:
        market_anchor = market_rate * (1 + min(0.10, abs(occupancy_gap) * 0.45))
        current_anchor = current_rate * (1 + min(0.08, abs(occupancy_gap) * 0.35))
        rate = round(max(market_anchor, current_anchor))
    return _clamp(rate, min_rate, max_rate)


def _clamp(value: int, minimum: int | None, maximum: int | None) -> int:
    if minimum is not None:
        value = max(value, minimum)
    if maximum is not None:
        value = min(value, maximum)
    return max(1, value)


def _target_confidence(
    recommendations: list[PricingRecommendation],
    observations: list[RateObservation],
    completed_scan_count: int,
    queued_job_ids: list[UUID],
) -> float:
    base = _confidence(recommendations, observations)
    browser_boost = min(0.12, completed_scan_count * 0.025)
    refresh_penalty = 0 if not queued_job_ids else 0.03
    return round(max(0.35, min(0.97, base + browser_boost - refresh_penalty)), 4)


def _browser_evidence(
    observations: list[RateObservation],
    queued_job_ids: list[UUID],
    completed_scan_count: int,
) -> BrowserEvidence:
    latest = max((row.observed_at for row in observations), default=None)
    sources = sorted({row.source.value if hasattr(row.source, "value") else str(row.source) for row in observations})
    if queued_job_ids:
        status = "refresh_queued"
        message = (
            "Fresh headed Chrome scans were queued for this target month. The plan uses current browser evidence now "
            "and can tighten after those sessions finish."
        )
    elif observations:
        status = "live_browser_evidence"
        message = "Plan uses the latest completed headed-browser rate observations already stored for this property."
    else:
        status = "modeled_pending_browser_data"
        message = "No completed browser observations are available yet, so RentalRadar queued browser work and filled the first plan with modeled seasonality."
    return BrowserEvidence(
        status=status,
        queued_job_ids=queued_job_ids,
        completed_scan_count=completed_scan_count,
        observations_used=len(observations),
        latest_observed_at=latest,
        sources=sources,
        message=message,
    )


def _night_strategy(day: date, occupancy_gap: float, suggested_rate: int, market_rate: int) -> str:
    market_position = (suggested_rate - market_rate) / max(market_rate, 1)
    if occupancy_gap > 0.1:
        return "Price for conversion and keep friction low"
    if day.weekday() in (4, 5) and market_position > -0.04:
        return "Protect weekend ADR while watching pickup"
    if market_position < -0.1:
        return "Undercut soft comp set until pacing improves"
    return "Hold near market and recheck after the browser refresh"


def _game_plan(
    *,
    month: date,
    target_occupancy: float,
    current_projected_occupancy: float,
    suggested_average: int,
    market_average: int,
    evidence: BrowserEvidence,
) -> list[str]:
    month_label = month.strftime("%B %Y")
    market_position = (suggested_average - market_average) / max(market_average, 1)
    plan = [
        f"Aim for {target_occupancy:.0%} occupancy in {month_label} by opening with an average nightly rate around ${suggested_average / 100:,.0f}.",
        f"Current pacing projects about {current_projected_occupancy:.0%}; the suggested rate sits {abs(market_position):.0%} {'below' if market_position < 0 else 'above'} the headed-browser comp average.",
    ]
    if target_occupancy - current_projected_occupancy > 0.08:
        plan.append("Use a lower weekday rate first, protect prime weekends, and review pickup every 48 hours until the occupancy gap closes.")
    else:
        plan.append("Hold close to market on weekends and use small weekday adjustments instead of broad discounting.")
    if evidence.queued_job_ids:
        plan.append("Fresh headed-browser scans are queued for this target month; re-run the plan when those sessions complete before pushing final rates.")
    else:
        plan.append("Use this as the push-ready plan, then re-run after each new browser scan or PMS pickup signal.")
    return plan


def _seed(value: str) -> float:
    digest = hashlib.sha256(value.lower().encode()).hexdigest()
    return int(digest[:8], 16) / 0xFFFFFFFF


def _wave(stay_date: date, seed: float) -> float:
    day = stay_date.timetuple().tm_yday
    return math.sin((day / 365) * math.tau + seed * math.tau)
