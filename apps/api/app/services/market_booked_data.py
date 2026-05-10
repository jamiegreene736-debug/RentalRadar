from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from statistics import median
from typing import Any

import httpx

from app.config import get_settings
from app.db.models import Property


@dataclass(frozen=True)
class MarketBookedRateSignal:
    source: str
    start_date: date
    end_date: date
    average_booked_rate_cents: int | None
    median_booked_rate_cents: int | None
    occupancy: float | None
    revpar_cents: int | None
    sample_size: int
    confidence: float
    raw_payload: dict[str, Any]


@dataclass(frozen=True)
class MarketBookedRateResult:
    provider: str
    status: str
    signals: list[MarketBookedRateSignal]
    message: str | None = None


def fetch_market_booked_rate_signals(
    rental: Property,
    start_date: date,
    end_date: date,
) -> MarketBookedRateResult:
    settings = get_settings()
    provider = settings.market_booked_data_provider.lower()
    if provider in {"", "none", "off", "disabled"}:
        return MarketBookedRateResult(provider=provider or "none", status="disabled", signals=[])
    if provider != "airroi":
        return MarketBookedRateResult(
            provider=provider,
            status="unsupported",
            signals=[],
            message=f"Unsupported market booked data provider: {provider}",
        )
    return _fetch_airroi_radius_signal(rental, start_date, end_date)


def _fetch_airroi_radius_signal(
    rental: Property,
    start_date: date,
    end_date: date,
) -> MarketBookedRateResult:
    settings = get_settings()
    if not settings.airroi_api_key:
        return MarketBookedRateResult(
            provider="airroi",
            status="missing_api_key",
            signals=[],
            message="AIRROI_API_KEY is not configured",
        )
    if rental.latitude is None or rental.longitude is None:
        return MarketBookedRateResult(
            provider="airroi",
            status="missing_coordinates",
            signals=[],
            message="Property latitude/longitude is required for AirROI radius comps",
        )

    payload = {
        "latitude": float(rental.latitude),
        "longitude": float(rental.longitude),
        "radius_miles": settings.airroi_radius_miles,
        "page_size": settings.airroi_page_size,
    }
    try:
        with httpx.Client(
            base_url=str(settings.airroi_base_url).rstrip("/"),
            timeout=settings.integration_http_timeout_seconds,
        ) as client:
            response = client.post(
                "/listings/search/radius",
                headers={"x-api-key": settings.airroi_api_key, "Accept": "application/json"},
                json=payload,
            )
            response.raise_for_status()
            body = response.json()
    except Exception as exc:
        return MarketBookedRateResult(
            provider="airroi",
            status="error",
            signals=[],
            message=str(exc),
        )

    signal = _signal_from_airroi_payload(body, start_date, end_date)
    return MarketBookedRateResult(
        provider="airroi",
        status="succeeded" if signal else "empty",
        signals=[signal] if signal else [],
        message=None if signal else "AirROI returned no usable booked-rate fields",
    )


def _signal_from_airroi_payload(
    payload: dict[str, Any],
    start_date: date,
    end_date: date,
) -> MarketBookedRateSignal | None:
    listings = _extract_listing_rows(payload)
    average_rates = [
        _money_to_cents(value) for row in listings for value in _candidate_rate_values(row)
    ]
    average_rates = [value for value in average_rates if value is not None and value > 0]
    occupancy_values = [
        _ratio(value) for row in listings for value in _candidate_occupancy_values(row)
    ]
    occupancy_values = [value for value in occupancy_values if value is not None]
    revpar_values = [
        _money_to_cents(value) for row in listings for value in _candidate_revpar_values(row)
    ]
    revpar_values = [value for value in revpar_values if value is not None and value > 0]

    aggregate_rate = _money_to_cents(
        _first_present(
            payload,
            "average_daily_rate",
            "average_adr",
            "average_rate",
            "avg_rate",
            "l90d_avg_rate",
            "ttm_avg_rate",
            "median_booked_rate",
            "mean_booked_rate",
        )
    )
    aggregate_occupancy = _ratio(
        _first_present(
            payload,
            "average_occupancy",
            "occupancy",
            "l90d_occupancy",
            "ttm_occupancy",
        )
    )
    aggregate_revpar = _money_to_cents(
        _first_present(payload, "revpar", "average_revpar", "l90d_revpar", "ttm_revpar")
    )

    median_rate = int(median(average_rates)) if average_rates else aggregate_rate
    average_rate = int(sum(average_rates) / len(average_rates)) if average_rates else aggregate_rate
    occupancy = (
        sum(occupancy_values) / len(occupancy_values) if occupancy_values else aggregate_occupancy
    )
    revpar = int(sum(revpar_values) / len(revpar_values)) if revpar_values else aggregate_revpar
    sample_size = len(average_rates) or _int_or_none(payload.get("total_count")) or len(listings)

    if median_rate is None and average_rate is None and occupancy is None and revpar is None:
        return None

    confidence = min(0.9, 0.38 + min(sample_size, 50) * 0.008)
    return MarketBookedRateSignal(
        source="airroi",
        start_date=start_date,
        end_date=end_date,
        average_booked_rate_cents=average_rate,
        median_booked_rate_cents=median_rate,
        occupancy=occupancy,
        revpar_cents=revpar,
        sample_size=sample_size,
        confidence=round(confidence, 4),
        raw_payload={
            "total_count": payload.get("total_count"),
            "sample_size": sample_size,
            "fields_used": {
                "rate_count": len(average_rates),
                "occupancy_count": len(occupancy_values),
                "revpar_count": len(revpar_values),
            },
        },
    )


def _extract_listing_rows(payload: dict[str, Any]) -> list[dict[str, Any]]:
    for key in ("results", "listings", "items", "data"):
        value = payload.get(key)
        if isinstance(value, list):
            return [row for row in value if isinstance(row, dict)]
        if isinstance(value, dict):
            nested = _extract_listing_rows(value)
            if nested:
                return nested
    return []


def _candidate_rate_values(row: dict[str, Any]) -> list[Any]:
    return [
        _first_present(row, "mean_booked_rate", "median_booked_rate", "booked_rate_avg"),
        _first_present(row, "l90d_avg_rate", "l90d_adr", "ttm_avg_rate", "ttm_adr"),
        _first_present(row, "average_daily_rate", "adr", "avg_rate", "rate_avg"),
    ]


def _candidate_occupancy_values(row: dict[str, Any]) -> list[Any]:
    return [
        _first_present(row, "l90d_occupancy", "ttm_occupancy"),
        _first_present(row, "occupancy", "occupancy_rate", "adjusted_occupancy"),
    ]


def _candidate_revpar_values(row: dict[str, Any]) -> list[Any]:
    return [_first_present(row, "l90d_revpar", "ttm_revpar", "revpar", "adjusted_revpar")]


def _first_present(payload: dict[str, Any], *keys: str) -> Any:
    for key in keys:
        value = payload.get(key)
        if value is not None:
            return value
    return None


def _money_to_cents(value: Any) -> int | None:
    number = _float_or_none(value)
    if number is None:
        return None
    if number > 10000:
        return int(round(number))
    return int(round(number * 100))


def _ratio(value: Any) -> float | None:
    number = _float_or_none(value)
    if number is None:
        return None
    if number > 1:
        number = number / 100
    return max(0.0, min(1.0, number))


def _float_or_none(value: Any) -> float | None:
    if value is None:
        return None
    if isinstance(value, str):
        value = value.replace("$", "").replace(",", "").strip()
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _int_or_none(value: Any) -> int | None:
    number = _float_or_none(value)
    return int(number) if number is not None else None
