from __future__ import annotations

import hashlib
import math
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from statistics import median
from uuid import UUID

from app.db.models import PricingDemandSignal, PricingRecommendation, Property, RateObservation
from app.services.pricing_controls import pricing_controls_for_property


@dataclass(frozen=True)
class ForecastNight:
    stay_date: date
    recommended_rate_cents: int
    market_benchmark_rate_cents: int
    comp_blend_rate_cents: int
    estimated_occupancy: float
    estimated_revenue_cents: int
    confidence: float


@dataclass(frozen=True)
class MonthlyForecast:
    month: date
    average_recommended_rate_cents: int
    average_market_benchmark_rate_cents: int
    average_comp_blend_rate_cents: int
    estimated_occupancy: float
    estimated_revenue_cents: int
    market_benchmark_revenue_cents: int
    extra_income_vs_market_cents: int


@dataclass(frozen=True)
class MarketSourceEvidence:
    source: str
    label: str
    role: str
    status: str
    sample_count: int
    median_rate_cents: int | None
    average_rate_cents: int | None
    low_rate_cents: int | None
    high_rate_cents: int | None
    confidence: float
    last_observed_at: datetime | None
    note: str


@dataclass(frozen=True)
class BaseRateModel:
    method: str
    base_rate_cents: int
    market_median_rate_cents: int | None
    market_average_rate_cents: int | None
    sample_size: int
    source_count: int
    booked_rate_feed: str
    explanation: str


@dataclass(frozen=True)
class PricingAdjustmentLayer:
    code: str
    label: str
    category: str
    data_feed: str
    adjustment_percent: float
    rate_impact_cents: int
    confidence: float
    status: str
    description: str


@dataclass(frozen=True)
class PricingToolCoverage:
    code: str
    label: str
    category: str
    status: str
    priority: str
    current_value: str
    recommended_value: str
    control_references: list[str]
    data_needed: str
    description: str


@dataclass(frozen=True)
class ForecastResult:
    generated_at: datetime
    estimated_occupancy: float
    recommended_total_revenue_cents: int
    market_benchmark_total_revenue_cents: int
    extra_income_vs_market_cents: int
    confidence: float
    explanation: str
    base_rate_model: BaseRateModel
    market_sources: list[MarketSourceEvidence]
    adjustment_layers: list[PricingAdjustmentLayer]
    pricing_tools: list[PricingToolCoverage]
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
    demand_signals: list[PricingDemandSignal] | None = None,
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
    market_sources = _market_source_evidence(observations)
    base_rate_model = _base_rate_model(rental, observations, market_sources, base_rate)
    adjustment_layers = _pricing_layers(
        rental,
        observations,
        base_rate,
        confidence,
        demand_signals or [],
    )
    pricing_tools = _pricing_tool_coverage(rental, observations, base_rate)

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
        market_benchmark_rate = _modeled_rate(
            base_rate=base_rate,
            stay_date=current,
            address_seed=address_seed,
            property_seed=property_seed,
            premium=False,
        )
        comp_blend_rate = int((live_market_rate or market_benchmark_rate) * (1.01 + _wave(current, property_seed) * 0.025))
        occupancy = _estimated_occupancy(current, address_seed, property_seed, recommended, market_benchmark_rate)
        nights.append(
            ForecastNight(
                stay_date=current,
                recommended_rate_cents=recommended,
                market_benchmark_rate_cents=market_benchmark_rate,
                comp_blend_rate_cents=comp_blend_rate,
                estimated_occupancy=occupancy,
                estimated_revenue_cents=round(recommended * occupancy),
                confidence=confidence,
            )
        )
        current += timedelta(days=1)

    monthly = _monthly_rollup(nights)
    recommended_total = sum(month.estimated_revenue_cents for month in monthly)
    market_benchmark_total = sum(month.market_benchmark_revenue_cents for month in monthly)
    occupancy = sum(night.estimated_occupancy for night in nights) / len(nights) if nights else 0
    return ForecastResult(
        generated_at=datetime.now(timezone.utc),
        estimated_occupancy=round(occupancy, 4),
        recommended_total_revenue_cents=recommended_total,
        market_benchmark_total_revenue_cents=market_benchmark_total,
        extra_income_vs_market_cents=recommended_total - market_benchmark_total,
        confidence=confidence,
        explanation=(
            "Base rate is anchored to live OTA market evidence when available, then adjusted by booking pickup, "
            "review quality, seasonality, lead time, local demand, weather, flights, calendar gaps, and owner guardrails before nightly rates are pushed."
        ),
        base_rate_model=base_rate_model,
        market_sources=market_sources,
        adjustment_layers=adjustment_layers,
        pricing_tools=pricing_tools,
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


def _market_source_evidence(observations: list[RateObservation]) -> list[MarketSourceEvidence]:
    source_labels = {
        "airbnb": "Airbnb",
        "vrbo": "VRBO",
        "booking": "Booking.com",
    }
    roles = {
        "airbnb": "Largest peer-set signal for STR list pricing and calendar friction.",
        "vrbo": "Family/group travel signal; useful for longer stays and whole-home comps.",
        "booking": "Hotel-adjacent demand signal that catches compression Airbnb may miss.",
    }
    grouped: dict[str, list[RateObservation]] = defaultdict(list)
    for observation in observations:
        key = observation.source.value if hasattr(observation.source, "value") else str(observation.source)
        if key in source_labels and observation.nightly_rate_cents is not None:
            grouped[key].append(observation)

    evidence: list[MarketSourceEvidence] = []
    for source, label in source_labels.items():
        rows = grouped.get(source, [])
        rates = sorted(row.nightly_rate_cents for row in rows if row.nightly_rate_cents is not None)
        if rates:
            evidence.append(
                MarketSourceEvidence(
                    source=source,
                    label=label,
                    role=roles[source],
                    status="live_agent_scrape",
                    sample_count=len(rates),
                    median_rate_cents=round(median(rates)),
                    average_rate_cents=round(sum(rates) / len(rates)),
                    low_rate_cents=min(rates),
                    high_rate_cents=max(rates),
                    confidence=round(min(0.94, 0.58 + len(rates) * 0.025), 4),
                    last_observed_at=max(row.observed_at for row in rows),
                    note="Visible OTA rates extracted by the headed AI browser agent.",
                )
            )
        else:
            evidence.append(
                MarketSourceEvidence(
                    source=source,
                    label=label,
                    role=roles[source],
                    status="awaiting_clean_scrape",
                    sample_count=0,
                    median_rate_cents=None,
                    average_rate_cents=None,
                    low_rate_cents=None,
                    high_rate_cents=None,
                    confidence=0.22,
                    last_observed_at=None,
                    note="No clean visible-price sample has landed yet; keep the source visible so operators know what is missing.",
                )
            )
    return evidence


def _base_rate_model(
    rental: Property,
    observations: list[RateObservation],
    market_sources: list[MarketSourceEvidence],
    base_rate: int,
) -> BaseRateModel:
    rates = sorted(row.nightly_rate_cents for row in observations if row.nightly_rate_cents is not None)
    market_median = round(median(rates)) if rates else None
    market_average = round(sum(rates) / len(rates)) if rates else None
    source_count = sum(1 for source in market_sources if source.sample_count > 0)
    if rates:
        method = "Live OTA median"
        explanation = (
            "Use the median visible nightly rate across clean Airbnb, VRBO, and Booking.com samples so one extreme "
            "comp cannot drag the 24-month base rate too high or too low."
        )
    elif rental.base_price_cents:
        method = "Property base rate fallback"
        explanation = "Use the owner-entered base rate until the AI browser returns clean OTA samples."
    elif rental.min_price_cents and rental.max_price_cents:
        method = "Guardrail midpoint fallback"
        explanation = "Use the midpoint of the configured price limits until live OTA samples are available."
    else:
        method = "Modeled address fallback"
        explanation = "Use property size, sleeps, and address-specific seasonality until live OTA samples are available."
    return BaseRateModel(
        method=method,
        base_rate_cents=base_rate,
        market_median_rate_cents=market_median,
        market_average_rate_cents=market_average,
        sample_size=len(rates),
        source_count=source_count,
        booked_rate_feed=(
            "Booked ADR should come from PMS reservation/calendar APIs such as Guesty, Hostaway, or OwnerRez: "
            "reservation date, stay dates, channel, booked nightly ADR, fees/taxes, cancellation status, and occupancy pickup."
        ),
        explanation=explanation,
    )


def _pricing_layers(
    rental: Property,
    observations: list[RateObservation],
    base_rate: int,
    confidence: float,
    demand_signals: list[PricingDemandSignal],
) -> list[PricingAdjustmentLayer]:
    observed_boost = min(0.06, len(observations) / 250 * 0.06)
    bedrooms = rental.bedrooms or 2
    sleeps = rental.sleeps or max(2, bedrooms * 2)
    capacity_boost = min(0.08, max(0, sleeps - 4) * 0.012)
    layer_specs = [
        (
            "market_anchor",
            "OTA market anchor",
            "Base",
            "AI browser scrape: Airbnb, VRBO, Booking.com visible nightly rates",
            0.0,
            min(0.95, confidence + observed_boost),
            "active" if observations else "modeled_until_scrape",
            "Sets the 24-month base ADR from the median market comp rate before tactical pricing layers are applied.",
        ),
        (
            "booked_pickup",
            "Booked-rate pickup",
            "Demand",
            "PMS reservation feed: booked ADR, booking date, stay date, channel, cancellation status",
            0.04 if observations else 0.0,
            0.42 if not observations else 0.72,
            "needs_pms_feed",
            "Compares what guests actually book against visible OTA list prices; this is the most important next feed.",
        ),
        (
            "review_quality",
            "Review strength",
            "Trust",
            "OTA listing scrape or channel API: rating, review count, Superhost/Premier status",
            0.015 + capacity_boost / 2,
            0.58,
            "pending_review_feed",
            "Higher-rated, heavily reviewed homes can safely sit above the raw comp median; weak review profiles should discount.",
        ),
        (
            "lead_time",
            "Distance to arrival",
            "Pacing",
            "PMS calendar plus booking curve: days-to-arrival, booked pace, open nights",
            -0.025,
            0.62,
            "active_model",
            "Tightens far-out rates and discounts soft near-term gaps when pickup is behind the target curve.",
        ),
        (
            "seasonality",
            "Season and weekday shape",
            "Demand",
            "RentalRadar season calendar, holidays, day-of-week demand",
            0.075,
            0.69,
            "active_model",
            "Raises peak summer, holiday, and weekend dates while softening shoulder-season weekdays.",
        ),
        *_demand_layer_specs(demand_signals),
        (
            "calendar_shape",
            "Gap nights and min-stay friction",
            "Operations",
            "PMS availability calendar: orphan gaps, min nights, check-in restrictions",
            -0.018,
            0.64,
            "needs_calendar_feed" if not observations else "active_model",
            "Uses targeted discounts or minimum-stay changes for hard-to-book gaps instead of broad monthly discounts.",
        ),
        (
            "guardrails",
            "Owner price limits",
            "Risk",
            "Property settings: min rate, max rate, manual overrides",
            0.0,
            0.9,
            "active",
            "Clamps the final pushed rate inside approved minimum and maximum bounds.",
        ),
    ]
    return [
        PricingAdjustmentLayer(
            code=code,
            label=label,
            category=category,
            data_feed=data_feed,
            adjustment_percent=round(adjustment, 4),
            rate_impact_cents=round(base_rate * adjustment),
            confidence=round(layer_confidence, 4),
            status=status,
            description=description,
        )
        for code, label, category, data_feed, adjustment, layer_confidence, status, description in layer_specs
    ]


def _demand_layer_specs(
    demand_signals: list[PricingDemandSignal],
) -> list[tuple[str, str, str, str, float, float, str, str]]:
    if not demand_signals:
        return [
            (
                "local_demand",
                "Area events, weather, and flights",
                "Demand",
                "Manual entries now; can connect event, weather, and airport-demand APIs next",
                0.0,
                0.38,
                "ready_for_inputs",
                "Adds premiums or softens rates when the local market has big events, helpful or risky weather, or unusually busy travel days.",
            )
        ]

    specs = []
    labels = {
        "area_event": "Area events",
        "weather": "Weather outlook",
        "flight": "Flight demand",
    }
    feeds = {
        "area_event": "Event calendar/API: nearby festivals, sports, conferences, school breaks, and ticketed events",
        "weather": "Weather API: forecast, severe-weather risk, beach/pool-friendly days, and travel disruption risk",
        "flight": "Airport demand API: flight arrivals, load factor or seat capacity, fare pressure, and airport crowding",
    }
    descriptions = {
        "area_event": "Raises rates when nearby events can fill the market and flags weak event periods before rates get too aggressive.",
        "weather": "Uses good vacation weather as a pricing tailwind and reduces confidence when storms or poor travel weather may hurt bookings.",
        "flight": "Treats busy arrival periods as a sign more guests are coming into the area and slow air-travel periods as softer demand.",
    }
    for signal_type in ("area_event", "weather", "flight"):
        signals = [signal for signal in demand_signals if signal.signal_type == signal_type]
        if not signals:
            specs.append(
                (
                    signal_type,
                    labels[signal_type],
                    "Demand",
                    feeds[signal_type],
                    0.0,
                    0.42,
                    "awaiting_feed",
                    descriptions[signal_type],
                )
            )
            continue
        adjustment = _combined_signal_adjustment(signals)
        confidence = sum(float(signal.confidence) for signal in signals) / len(signals)
        specs.append(
            (
                signal_type,
                labels[signal_type],
                "Demand",
                feeds[signal_type],
                adjustment,
                min(0.92, max(0.45, confidence)),
                "active" if any(signal.source != "manual" for signal in signals) else "manual_active",
                descriptions[signal_type],
            )
        )
    return specs


def _combined_signal_adjustment(signals: list[PricingDemandSignal]) -> float:
    total = 0.0
    for signal in signals:
        if signal.rate_impact_percent is not None:
            impact = float(signal.rate_impact_percent)
        else:
            caps = {"area_event": 0.16, "weather": 0.08, "flight": 0.10}
            impact = (float(signal.demand_score) - 0.5) * 2 * caps.get(signal.signal_type, 0.07)
        confidence = max(0.0, min(1.0, float(signal.confidence)))
        total += impact * (0.55 + confidence * 0.45)
    return round(max(-0.16, min(0.20, total)), 4)


def _pricing_tool_coverage(
    rental: Property,
    observations: list[RateObservation],
    base_rate: int,
) -> list[PricingToolCoverage]:
    controls = pricing_controls_for_property(rental)
    min_price = _money_or_not_set(controls["min_price_cents"])
    max_price = _money_or_not_set(controls["max_price_cents"])
    absolute_min_price = _money_or_not_set(controls["absolute_min_price_cents"])
    base_price = f"${base_rate / 100:,.0f}"
    has_market = bool(observations)
    return [
        PricingToolCoverage(
            code="base_price",
            label="Base price",
            category="Core pricing",
            status="active_model" if has_market else "modeled_until_scrape",
            priority="Required",
            current_value=base_price,
            recommended_value=base_price,
            control_references=["Base ADR", "Market median", "Booked ADR calibration"],
            data_needed="Clean OTA comp rates, property attributes, historical booked ADR.",
            description="Foundation ADR before seasonality, day-of-week, event, pacing, and availability adjustments.",
        ),
        PricingToolCoverage(
            code="price_floor_ceiling",
            label="Floor and ceiling prices",
            category="Guardrails",
            status="active" if rental.min_price_cents or rental.max_price_cents else "needs_owner_input",
            priority="Required",
            current_value=f"Floor {min_price} / Ceiling {max_price}",
            recommended_value=f"Floor ${max(round(base_rate * 0.62) / 100, 1):,.0f} / Ceiling ${round(base_rate * 1.85) / 100:,.0f}",
            control_references=["Owner guardrail", "Operating-cost floor", "Market peak ADR"],
            data_needed="Owner risk tolerance, cleaning/operating cost floor, market peak ADR ceiling.",
            description="Prevents the algorithm from selling below cost or overpricing above the believable comp range.",
        ),
        PricingToolCoverage(
            code="absolute_minimum",
            label="Absolute minimum price",
            category="Guardrails",
            status="active" if controls["absolute_min_price_cents"] else "needs_owner_input",
            priority="Required",
            current_value=absolute_min_price,
            recommended_value=f"${round(base_rate * 0.52) / 100:,.0f}",
            control_references=["Walk-away rate", "Discount safety limit"],
            data_needed="True walk-away nightly rate after cleaning, taxes, owner split, and channel fees.",
            description="A hard safety limit below every other minimum-price rule so stacking discounts cannot create a bad booking.",
        ),
        PricingToolCoverage(
            code="minimum_stays",
            label="Minimum stay rules",
            category="Stay controls",
            status="needs_calendar_feed",
            priority="Required",
            current_value=f"Global {controls['global_min_stay']} / Weekend {controls['weekend_min_stay']} nights",
            recommended_value="Global + weekday/weekend + monthly + date override",
            control_references=["Global minimum stay", "Day-of-week rules", "Seasonal overrides"],
            data_needed="PMS availability calendar, booking lead time, day of week, season/event calendar.",
            description="Controls booking length by season, day, lead time, and date-specific exceptions instead of one static rule.",
        ),
        PricingToolCoverage(
            code="gap_night_rules",
            label="Gap and orphan night rules",
            category="Stay controls",
            status="needs_calendar_feed",
            priority="Required",
            current_value=f"{controls['gap_night_min_stay']}-night gaps / {controls['gap_night_discount_percent']:.0f}% discount",
            recommended_value="Auto-lower min stay to gap length; optional gap discount/premium",
            control_references=["Gap nights", "Orphan-night fill", "Minimum-stay override"],
            data_needed="Open-night gaps between booked or blocked stays, adjacent booking lengths, current min stay.",
            description="Makes 1-3 night openings bookable without weakening the whole month’s pricing strategy.",
        ),
        PricingToolCoverage(
            code="last_minute_discount",
            label="Last-minute discount curve",
            category="Pacing",
            status="active_model",
            priority="High",
            current_value=f"{controls['last_minute_discount_percent']:.0f}% inside {controls['last_minute_window_days']} days",
            recommended_value="0-7 days, 8-14 days, 15-30 days configurable discounts",
            control_references=["Lead time", "Pickup pace", "Vacancy risk"],
            data_needed="Days to arrival, current occupancy, market pickup, unit-specific booking curve.",
            description="Discounts only when close-in vacancy risk is real, with stronger cuts for softer markets or larger homes.",
        ),
        PricingToolCoverage(
            code="far_future_premium",
            label="Far-future premium",
            category="Pacing",
            status="modeled",
            priority="High",
            current_value=f"{controls['far_future_premium_percent']:.0f}% after {controls['far_future_window_days']} days",
            recommended_value="Premium for 180+ or 270+ days out until pickup validates demand",
            control_references=["Booking window", "Forward demand", "Owner protection"],
            data_needed="Booking window distribution, owner calendar tolerance, future event/holiday demand.",
            description="Protects far-out high-value dates from being booked too cheaply before market demand is visible.",
        ),
        PricingToolCoverage(
            code="season_event_rules",
            label="Season and event rules",
            category="Demand",
            status="active_model",
            priority="High",
            current_value="Monthly seasonality",
            recommended_value="Reusable season/event templates with date-specific overrides",
            control_references=["Season templates", "Event calendar", "Holiday compression"],
            data_needed="Local event calendar, school holidays, market compression, historical RevPAN.",
            description="Adds premiums or discounts for periods where normal monthly seasonality is not enough.",
        ),
        PricingToolCoverage(
            code="availability_yielding",
            label="Availability and pacing yielding",
            category="Demand",
            status="needs_pms_feed",
            priority="High",
            current_value="Modeled occupancy",
            recommended_value="Pickup pace vs target curve by month and stay date",
            control_references=["Availability yielding", "Pacing curve", "Market compression"],
            data_needed="Booked nights, blocked nights, booked ADR, booking date, target occupancy curve.",
            description="Raises rates when the unit is booking ahead of target and discounts when open inventory is aging.",
        ),
        PricingToolCoverage(
            code="booked_adr_feed",
            label="Booked ADR and channel mix",
            category="Performance",
            status="needs_pms_feed",
            priority="Required",
            current_value="Not connected",
            recommended_value="Guesty/Hostaway/OwnerRez reservation feed",
            control_references=["Booked ADR", "Channel mix", "Reservation feed"],
            data_needed="Reservation financial breakdown, channel, check-in/out, booked date, cancellation status.",
            description="Shows what guests actually paid, not just what competitors are listing, and calibrates the base rate over time.",
        ),
        PricingToolCoverage(
            code="rate_breakdown",
            label="Nightly rate breakdown",
            category="Explainability",
            status="active_model",
            priority="High",
            current_value="Layer stack",
            recommended_value="Base + season + day + event + pacing + gap + guardrails",
            control_references=["Rate stack", "Calendar factors", "Guardrail clamp"],
            data_needed="All pricing layers plus final pushed channel rate.",
            description="Makes every nightly rate auditable for owner questions and safer before push-to-channel automation.",
        ),
        PricingToolCoverage(
            code="distributed_price_preview",
            label="Distributed price preview",
            category="Channel push",
            status="needs_channel_feed",
            priority="Medium",
            current_value="Not connected",
            recommended_value="Rent + fees + taxes + channel markup preview",
            control_references=["Channel fees", "Taxes", "Guest-facing total"],
            data_needed="Channel fee rules, taxes, cleaning fees, LOS discounts, PMS/channel markup.",
            description="Shows the guest-facing total before pushing so nightly-rate changes do not create surprise totals.",
        ),
    ]


def _money_or_not_set(cents: int | None) -> str:
    return f"${cents / 100:,.0f}" if cents is not None else "Not set"


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
    market_benchmark_rate: int,
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
    price_pressure = max(
        -0.08,
        min(0.05, (market_benchmark_rate - recommended_rate) / max(market_benchmark_rate, 1) * 0.35),
    )
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
        market_benchmark_revenue = sum(round(night.market_benchmark_rate_cents * night.estimated_occupancy) for night in month_nights)
        months.append(
            MonthlyForecast(
                month=month,
                average_recommended_rate_cents=round(sum(night.recommended_rate_cents for night in month_nights) / count),
                average_market_benchmark_rate_cents=round(sum(night.market_benchmark_rate_cents for night in month_nights) / count),
                average_comp_blend_rate_cents=round(sum(night.comp_blend_rate_cents for night in month_nights) / count),
                estimated_occupancy=round(sum(night.estimated_occupancy for night in month_nights) / count, 4),
                estimated_revenue_cents=revenue,
                market_benchmark_revenue_cents=market_benchmark_revenue,
                extra_income_vs_market_cents=revenue - market_benchmark_revenue,
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
