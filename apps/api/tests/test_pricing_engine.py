from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from uuid import uuid4

from app.db.models import LocalEvent, OccupancySignal, Property, RateObservation, ScrapeSource
from app.services.market_booked_data import MarketBookedRateSignal
from app.services.pricing_engine import RentalRadarPricingEngine


def test_pricing_engine_uses_live_data_events_and_occupancy() -> None:
    stay_date = date.today() + timedelta(days=21)
    property_id = uuid4()
    rental = Property(
        id=property_id,
        organization_id=uuid4(),
        address_line1="123 Beach Ave",
        country_code="US",
        currency_code="USD",
        base_price_cents=20000,
        min_price_cents=15000,
        max_price_cents=50000,
        bedrooms=2,
        sleeps=6,
        active=True,
    )
    observations = [
        RateObservation(
            property_id=property_id,
            source=ScrapeSource.airbnb,
            stay_date=stay_date,
            nightly_rate_cents=28000,
            total_rate_cents=31000,
            available=False,
            extraction_confidence=0.9,
            raw_payload={},
        ),
        RateObservation(
            property_id=property_id,
            source=ScrapeSource.vrbo,
            stay_date=stay_date,
            nightly_rate_cents=30000,
            total_rate_cents=33000,
            available=False,
            extraction_confidence=0.85,
            raw_payload={},
        ),
        RateObservation(
            property_id=property_id,
            source=ScrapeSource.booking,
            stay_date=stay_date,
            nightly_rate_cents=32000,
            total_rate_cents=35000,
            available=True,
            extraction_confidence=0.8,
            raw_payload={},
        ),
    ]
    events = [
        LocalEvent(
            organization_id=rental.organization_id,
            property_id=property_id,
            name="Beach Music Festival",
            category="festival",
            starts_on=stay_date,
            ends_on=stay_date,
            demand_score=0.9,
            source="manual",
        )
    ]
    occupancy = [
        OccupancySignal(
            property_id=property_id,
            stay_date=stay_date,
            market_occupancy=0.88,
            pacing_ratio=1.2,
            pickup_7d=4,
            source="pms",
            observed_at=datetime.now(timezone.utc),
        )
    ]

    decisions = RentalRadarPricingEngine().recommend(
        rental=rental,
        market_observations=observations,
        events=events,
        occupancy_signals=occupancy,
        performance_events=[],
        start_date=stay_date,
        end_date=stay_date,
    )

    decision = decisions[0]
    assert decision.recommended_rate_cents > 30000
    assert decision.recommended_min_stay == 3
    assert decision.discount_percent == 0
    assert decision.confidence > 0.7
    assert "competitive_logic" in decision.explanation
    assert decision.explanation["ai_advice"]["provider"] == "stub"


def test_pricing_engine_uses_market_booked_rate_when_live_comps_are_missing() -> None:
    stay_date = date.today() + timedelta(days=45)
    property_id = uuid4()
    rental = Property(
        id=property_id,
        organization_id=uuid4(),
        address_line1="123 Beach Ave",
        country_code="US",
        currency_code="USD",
        base_price_cents=18000,
        min_price_cents=12000,
        max_price_cents=50000,
        bedrooms=2,
        sleeps=6,
        active=True,
    )
    market_booked = MarketBookedRateSignal(
        source="airroi",
        start_date=stay_date,
        end_date=stay_date,
        average_booked_rate_cents=29500,
        median_booked_rate_cents=31000,
        occupancy=0.82,
        revpar_cents=25420,
        sample_size=42,
        confidence=0.72,
        raw_payload={},
    )

    decisions = RentalRadarPricingEngine().recommend(
        rental=rental,
        market_observations=[],
        events=[],
        occupancy_signals=[],
        performance_events=[],
        start_date=stay_date,
        end_date=stay_date,
        market_booked_signals=[market_booked],
        market_booked_status={"provider": "airroi", "status": "succeeded", "message": None},
    )

    decision = decisions[0]
    assert decision.explanation["baseline_rate_cents"] == 31000
    assert decision.explanation["market_booked_rate"]["booked_rate_cents"] == 31000
    assert decision.explanation["competitive_logic"]["market_paid_rate_cents"] == 31000
    assert decision.recommended_rate_cents > rental.base_price_cents
