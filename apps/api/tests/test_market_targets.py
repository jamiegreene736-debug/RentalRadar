from __future__ import annotations

from datetime import date
from urllib.parse import parse_qs, urlparse
from uuid import uuid4

from app.db.models import Property, ScrapeSource
from app.services.market import default_market_targets, normalize_market_target_url
from app.services.season_calendar import season_profile_for_property


def test_vrbo_default_market_target_uses_current_search_query_shape() -> None:
    url = default_market_targets(
        "910, Seasons Boulevard, Osceola County, Florida, 34746, United States",
        date(2026, 7, 13),
        date(2026, 7, 20),
    )[1]

    parsed = urlparse(url)
    query = parse_qs(parsed.query)

    assert parsed.netloc == "www.vrbo.com"
    assert parsed.path == "/search/keywords%3A910%2C%20Seasons%20Boulevard%2C%20Osceola%20County%2C%20Florida%2C%2034746%2C%20United%20States"
    assert query["d1"] == ["2026-07-13"]
    assert query["d2"] == ["2026-07-20"]
    assert query["adults"] == ["2"]


def test_legacy_vrbo_keywords_target_is_normalized_for_retries() -> None:
    legacy_url = (
        "https://www.vrbo.com/search/keywords:910%2C+Seasons+Boulevard%2C+Osceola+County"
        "%2C+Florida%2C+34746%2C+United+States?d1=2026-07-13&d2=2026-07-20&adults=2"
    )

    normalized = normalize_market_target_url(legacy_url, ScrapeSource.vrbo)
    parsed = urlparse(normalized)

    assert parsed.path == "/search/keywords%3A910%2C%20Seasons%20Boulevard%2C%20Osceola%20County%2C%20Florida%2C%2034746%2C%20United%20States"
    assert "keywords:" not in normalized
    assert "destination=" not in normalized


def test_central_florida_property_gets_market_specific_season_calendar() -> None:
    rental = Property(
        id=uuid4(),
        organization_id=uuid4(),
        address_line1="910 Seasons Boulevard",
        city="Kissimmee",
        region="FL",
        country_code="US",
        formatted_address="910 Seasons Boulevard, Osceola County, Florida, 34746, United States",
    )

    profile = season_profile_for_property(rental)

    assert profile.market_key == "central_florida"
    assert [season.code for season in profile.seasons] == ["low", "middle", "high"]
    assert profile.seasons[0].months == [1, 2, 9, 11]
    assert any(holiday.label == "Christmas / New Year" for holiday in profile.holidays)
