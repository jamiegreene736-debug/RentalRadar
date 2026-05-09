from __future__ import annotations

from collections import OrderedDict
from dataclasses import dataclass
from datetime import date, timedelta
from urllib.parse import quote_plus, urlencode, urlparse
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


@dataclass(frozen=True)
class SeasonalSearchTarget:
    url: str
    stay_date_start: date
    stay_date_end: date
    season_label: str


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

    targets = (
        [
            SeasonalSearchTarget(
                url=url,
                stay_date_start=date.today(),
                stay_date_end=date.today() + timedelta(days=scan_days),
                season_label="User comp",
            )
            for url in comp_urls
        ]
        if comp_urls
        else default_seasonal_market_targets(address)
    )
    jobs: list[ScrapeJob] = []
    for target in targets:
        target_url = target.url
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
            stay_date_start=target.stay_date_start,
            stay_date_end=target.stay_date_end,
            status=ScrapeJobStatus.queued,
            request_context={"trigger": "property_create", "season": target.season_label},
        )
        db.add(job)
        jobs.append(job)

    db.commit()
    for job in jobs:
        db.refresh(job)
    db.refresh(rental)
    return rental, jobs


def default_market_targets(address: str, checkin: date | None = None, checkout: date | None = None) -> list[str]:
    query = quote_plus(address)
    if not checkin or not checkout:
        return [
            f"https://www.airbnb.com/s/{query}/homes",
            f"https://www.vrbo.com/search/keywords:{query}",
            f"https://www.booking.com/searchresults.html?ss={query}",
        ]

    checkin_value = checkin.isoformat()
    checkout_value = checkout.isoformat()
    return [
        f"https://www.airbnb.com/s/{query}/homes?"
        f"{urlencode({'checkin': checkin_value, 'checkout': checkout_value, 'adults': 2})}",
        f"https://www.vrbo.com/search/keywords:{query}?"
        f"{urlencode({'d1': checkin_value, 'd2': checkout_value, 'adults': 2})}",
        f"https://www.booking.com/searchresults.html?"
        f"{urlencode({'ss': address, 'checkin': checkin_value, 'checkout': checkout_value, 'group_adults': 2, 'no_rooms': 1, 'group_children': 0})}",
    ]


def default_seasonal_market_targets(
    address: str,
    *,
    start_date: date | None = None,
    months_ahead: int = 24,
    stay_nights: int = 7,
) -> list[SeasonalSearchTarget]:
    targets: list[SeasonalSearchTarget] = []
    for season in seasonal_search_windows(start_date=start_date, months_ahead=months_ahead, stay_nights=stay_nights):
        checkout = season.stay_date_end + timedelta(days=1)
        for url in default_market_targets(address, season.stay_date_start, checkout):
            targets.append(
                SeasonalSearchTarget(
                    url=url,
                    stay_date_start=season.stay_date_start,
                    stay_date_end=season.stay_date_end,
                    season_label=season.season_label,
                )
            )
    return targets


def seasonal_search_windows(
    *,
    start_date: date | None = None,
    months_ahead: int = 24,
    stay_nights: int = 7,
) -> list[SeasonalSearchTarget]:
    start = start_date or date.today()
    cursor = date(start.year, start.month, 1)
    horizon = _add_months(cursor, months_ahead)
    groups: OrderedDict[tuple[str, int], list[date]] = OrderedDict()
    while cursor < horizon:
        key = _season_key(cursor.year, cursor.month)
        groups.setdefault(key, []).append(cursor)
        cursor = _add_months(cursor, 1)

    windows: list[SeasonalSearchTarget] = []
    for (season_name, season_year), months in groups.items():
        group_start = max(start, months[0])
        group_end = _last_day_of_month(months[-1])
        latest_checkin = group_end - timedelta(days=stay_nights - 1)
        if latest_checkin < group_start:
            continue
        span_days = max(0, (latest_checkin - group_start).days)
        checkin = group_start + timedelta(days=max(0, span_days // 2))
        checkout = checkin + timedelta(days=stay_nights)
        windows.append(
            SeasonalSearchTarget(
                url="",
                stay_date_start=checkin,
                stay_date_end=checkout - timedelta(days=1),
                season_label=f"{season_name} {season_year}",
            )
        )
    return windows


def _season_key(year: int, month: int) -> tuple[str, int]:
    if month in (12, 1, 2):
        return ("Winter", year + 1 if month == 12 else year)
    if month in (3, 4, 5):
        return ("Spring", year)
    if month in (6, 7, 8):
        return ("Summer", year)
    return ("Fall", year)


def _add_months(value: date, months: int) -> date:
    month_index = value.month - 1 + months
    return date(value.year + month_index // 12, month_index % 12 + 1, 1)


def _last_day_of_month(value: date) -> date:
    return _add_months(value, 1) - timedelta(days=1)


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
