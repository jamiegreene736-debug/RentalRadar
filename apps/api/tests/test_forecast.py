from __future__ import annotations

from datetime import date, datetime, timezone
from uuid import uuid4

from app.db.models import PricingDemandSignal, Property, RateObservation, ScrapeSource
from app.services.forecast import build_rate_forecast, build_target_occupancy_plan


def test_target_occupancy_plan_uses_browser_evidence_and_queues_refresh() -> None:
    property_id = uuid4()
    rental = Property(
        id=property_id,
        organization_id=uuid4(),
        address_line1="123 Beach Ave",
        formatted_address="123 Beach Ave, Lahaina, HI",
        country_code="US",
        currency_code="USD",
        base_price_cents=30000,
        min_price_cents=18000,
        max_price_cents=60000,
        bedrooms=3,
        sleeps=8,
        active=True,
    )
    observations = [
        RateObservation(
            property_id=property_id,
            source=ScrapeSource.airbnb,
            stay_date=date(2026, 7, 1),
            nightly_rate_cents=42000,
            total_rate_cents=47000,
            available=True,
            extraction_confidence=0.86,
            observed_at=datetime.now(timezone.utc),
            raw_payload={"browser": "headed_chrome"},
        ),
        RateObservation(
            property_id=property_id,
            source=ScrapeSource.vrbo,
            stay_date=date(2026, 7, 1),
            nightly_rate_cents=39000,
            total_rate_cents=44000,
            available=True,
            extraction_confidence=0.82,
            observed_at=datetime.now(timezone.utc),
            raw_payload={"browser": "headed_chrome"},
        ),
    ]
    queued_job_id = uuid4()

    plan = build_target_occupancy_plan(
        rental=rental,
        recommendations=[],
        observations=observations,
        target_month=date(2026, 7, 1),
        target_occupancy=0.9,
        queued_job_ids=[queued_job_id],
        completed_scan_count=2,
    )

    assert plan.target_month == date(2026, 7, 1)
    assert plan.suggested_average_rate_cents > 0
    assert plan.projected_revenue_cents > 0
    assert plan.browser_evidence.queued_job_ids == [queued_job_id]
    assert plan.browser_evidence.observations_used == 2
    assert "airbnb" in plan.browser_evidence.sources
    assert len(plan.nights) == 31


def test_rate_forecast_surfaces_event_weather_and_flight_layers() -> None:
    property_id = uuid4()
    organization_id = uuid4()
    rental = Property(
        id=property_id,
        organization_id=organization_id,
        address_line1="123 Beach Ave",
        formatted_address="123 Beach Ave, Lahaina, HI",
        country_code="US",
        currency_code="USD",
        base_price_cents=30000,
        min_price_cents=18000,
        max_price_cents=60000,
        bedrooms=3,
        sleeps=8,
        active=True,
    )
    signal_date = date.today()
    demand_signals = [
        PricingDemandSignal(
            organization_id=organization_id,
            property_id=property_id,
            signal_type="area_event",
            label="Food and wine festival",
            starts_on=signal_date,
            ends_on=signal_date,
            demand_score=0.9,
            confidence=0.82,
            source="manual",
        ),
        PricingDemandSignal(
            organization_id=organization_id,
            property_id=property_id,
            signal_type="flight",
            label="Heavy arrivals",
            starts_on=signal_date,
            ends_on=signal_date,
            demand_score=0.8,
            confidence=0.74,
            source="manual",
        ),
    ]

    forecast = build_rate_forecast(
        rental=rental,
        recommendations=[],
        observations=[],
        months=6,
        demand_signals=demand_signals,
    )

    layers = {layer.code: layer for layer in forecast.adjustment_layers}
    assert layers["area_event"].rate_impact_cents > 0
    assert layers["flight"].rate_impact_cents > 0
    assert layers["weather"].status == "awaiting_feed"
