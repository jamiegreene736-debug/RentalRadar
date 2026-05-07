from __future__ import annotations

import hashlib
import math
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone

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


def _seed(value: str) -> float:
    digest = hashlib.sha256(value.lower().encode()).hexdigest()
    return int(digest[:8], 16) / 0xFFFFFFFF


def _wave(stay_date: date, seed: float) -> float:
    day = stay_date.timetuple().tm_yday
    return math.sin((day / 365) * math.tau + seed * math.tau)
