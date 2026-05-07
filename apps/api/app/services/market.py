from __future__ import annotations

from datetime import date, timedelta
from urllib.parse import quote_plus, urlparse
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import (
    Competitor,
    CompSet,
    PricingRecommendation,
    Property,
    RateObservation,
    ScrapeJob,
    ScrapeJobStatus,
    ScrapeSource,
)
from app.services.geocoding import normalize_address


def create_property_and_jobs(
    db: Session,
    organization_id: UUID,
    address: str,
    name: str | None,
    bedrooms: int | None,
    bathrooms: float | None,
    sleeps: int | None,
    property_type: str | None,
    base_price_cents: int | None,
    min_price_cents: int | None,
    max_price_cents: int | None,
    comp_urls: list[str],
    scan_days: int,
) -> tuple[Property, list[ScrapeJob]]:
    normalized = normalize_address(address)
    rental = Property(
        organization_id=organization_id,
        name=name,
        address_line1=str(normalized["address_line1"]),
        city=normalized["city"],
        region=normalized["region"],
        postal_code=normalized["postal_code"],
        country_code=str(normalized["country_code"]),
        formatted_address=str(normalized["formatted_address"]),
        latitude=normalized["latitude"],
        longitude=normalized["longitude"],
        bedrooms=bedrooms,
        bathrooms=bathrooms,
        sleeps=sleeps,
        property_type=property_type,
        base_price_cents=base_price_cents,
        min_price_cents=min_price_cents,
        max_price_cents=max_price_cents,
        metadata_={"geocoder": "phase1_deterministic"},
    )
    db.add(rental)
    db.flush()

    comp_set = CompSet(
        property_id=rental.id,
        name="Initial market scan",
        search_radius_km=10,
        bedrooms_min=max(0, bedrooms - 1) if bedrooms is not None else None,
        bedrooms_max=bedrooms + 1 if bedrooms is not None else None,
        sleeps_min=max(0, sleeps - 2) if sleeps is not None else None,
        sleeps_max=sleeps + 2 if sleeps is not None else None,
        selection_rules={"phase": "address_onboarding"},
    )
    db.add(comp_set)
    db.flush()

    targets = comp_urls or default_market_targets(address)
    jobs: list[ScrapeJob] = []
    for target_url in targets:
        source = infer_source(target_url)
        competitor = Competitor(
            comp_set_id=comp_set.id,
            property_id=rental.id,
            source=source,
            external_url=target_url,
            canonical_url=target_url,
            title=None,
            active=True,
            similarity_score=0.75,
            metadata_={"discovery": "user_url" if comp_urls else "generated_search_url"},
        )
        db.add(competitor)
        db.flush()

        job = ScrapeJob(
            organization_id=organization_id,
            property_id=rental.id,
            competitor_id=competitor.id,
            source=source,
            target_url=target_url,
            stay_date_start=date.today(),
            stay_date_end=date.today() + timedelta(days=scan_days),
            status=ScrapeJobStatus.queued,
            request_context={"trigger": "property_create"},
        )
        db.add(job)
        jobs.append(job)

    db.commit()
    for job in jobs:
        db.refresh(job)
    db.refresh(rental)
    return rental, jobs


def default_market_targets(address: str) -> list[str]:
    query = quote_plus(address)
    return [
        f"https://www.airbnb.com/s/{query}/homes",
        f"https://www.vrbo.com/search/keywords:{query}",
        f"https://www.booking.com/searchresults.html?ss={query}",
    ]


def infer_source(url: str) -> ScrapeSource:
    hostname = urlparse(url).netloc.lower()
    if "airbnb" in hostname:
        return ScrapeSource.airbnb
    if "vrbo" in hostname or "homeaway" in hostname:
        return ScrapeSource.vrbo
    if "booking" in hostname:
        return ScrapeSource.booking
    if any(provider in hostname for provider in ["guesty", "hostaway", "ownerrez", "lodgify"]):
        return ScrapeSource.direct_pms
    return ScrapeSource.other


def get_market_rates(db: Session, property_id: UUID) -> tuple[list[RateObservation], list[PricingRecommendation]]:
    observations = db.scalars(
        select(RateObservation)
        .where(RateObservation.property_id == property_id)
        .order_by(RateObservation.stay_date.asc(), RateObservation.observed_at.desc())
        .limit(1000)
    ).all()
    recommendations = db.scalars(
        select(PricingRecommendation)
        .where(PricingRecommendation.property_id == property_id)
        .order_by(PricingRecommendation.stay_date.asc(), PricingRecommendation.created_at.desc())
        .limit(365)
    ).all()
    return list(observations), list(recommendations)
