from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from typing import Any
from uuid import UUID

import httpx
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db.models import PricingDemandSignal, Property


AUTO_SIGNAL_SOURCES = {"open-meteo", "ticketmaster", "aviationstack"}


@dataclass(frozen=True)
class DemandSignalRefreshResult:
    property_id: UUID
    created_count: int
    providers: dict[str, dict[str, Any]] = field(default_factory=dict)


def refresh_live_demand_signals(
    db: Session,
    property_id: UUID,
    start_date: date,
    end_date: date,
) -> DemandSignalRefreshResult:
    settings = get_settings()
    rental = db.scalar(select(Property).where(Property.id == property_id))
    if rental is None or not settings.demand_signals_auto_refresh_enabled:
        return DemandSignalRefreshResult(
            property_id=property_id,
            created_count=0,
            providers={"status": {"status": "skipped"}},
        )

    providers: dict[str, dict[str, Any]] = {}
    signals: list[PricingDemandSignal] = []

    weather_signals, providers["weather"] = _fetch_weather_signals(rental, start_date, end_date)
    event_signals, providers["events"] = _fetch_event_signals(rental, start_date, end_date)
    flight_signals, providers["flights"] = _fetch_flight_signals(rental, start_date, end_date)
    signals.extend(weather_signals)
    signals.extend(event_signals)
    signals.extend(flight_signals)

    db.execute(
        delete(PricingDemandSignal)
        .where(PricingDemandSignal.organization_id == rental.organization_id)
        .where(PricingDemandSignal.starts_on <= end_date)
        .where(PricingDemandSignal.ends_on >= start_date)
        .where(PricingDemandSignal.source.in_(AUTO_SIGNAL_SOURCES))
        .where(
            (PricingDemandSignal.property_id.is_(None))
            | (PricingDemandSignal.property_id == property_id)
        )
    )
    for signal in signals:
        db.add(signal)
    db.flush()
    return DemandSignalRefreshResult(
        property_id=property_id,
        created_count=len(signals),
        providers=providers,
    )


def _fetch_weather_signals(
    rental: Property,
    start_date: date,
    end_date: date,
) -> tuple[list[PricingDemandSignal], dict[str, Any]]:
    if rental.latitude is None or rental.longitude is None:
        return [], {"status": "skipped", "message": "Property latitude/longitude is required."}

    settings = get_settings()
    forecast_end = min(end_date, start_date + timedelta(days=15))
    try:
        with httpx.Client(timeout=settings.demand_signal_http_timeout_seconds) as client:
            response = client.get(
                f"{settings.open_meteo_base_url.rstrip('/')}/forecast",
                params={
                    "latitude": float(rental.latitude),
                    "longitude": float(rental.longitude),
                    "daily": ",".join(
                        [
                            "weather_code",
                            "temperature_2m_max",
                            "precipitation_probability_max",
                            "wind_speed_10m_max",
                        ]
                    ),
                    "temperature_unit": "fahrenheit",
                    "wind_speed_unit": "mph",
                    "timezone": "auto",
                    "start_date": start_date.isoformat(),
                    "end_date": forecast_end.isoformat(),
                },
            )
            response.raise_for_status()
            payload = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        return [], {"status": "failed", "message": str(exc)[:300]}

    daily = payload.get("daily") if isinstance(payload, dict) else None
    if not isinstance(daily, dict):
        return [], {"status": "failed", "message": "Weather provider returned no daily forecast."}

    days = daily.get("time") or []
    signals: list[PricingDemandSignal] = []
    for index, day_value in enumerate(days):
        try:
            stay_date = date.fromisoformat(day_value)
        except (TypeError, ValueError):
            continue
        code = _daily_value(daily, "weather_code", index)
        temp_f = _daily_value(daily, "temperature_2m_max", index)
        rain_pct = _daily_value(daily, "precipitation_probability_max", index)
        wind_mph = _daily_value(daily, "wind_speed_10m_max", index)
        demand_score, impact, label = _weather_demand_read(code, temp_f, rain_pct, wind_mph)
        signals.append(
            PricingDemandSignal(
                organization_id=rental.organization_id,
                property_id=rental.id,
                signal_type="weather",
                label=label,
                starts_on=stay_date,
                ends_on=stay_date,
                demand_score=demand_score,
                rate_impact_percent=impact,
                confidence=0.76,
                source="open-meteo",
                metadata_={
                    "weather_code": code,
                    "temperature_2m_max_f": temp_f,
                    "precipitation_probability_max": rain_pct,
                    "wind_speed_10m_max_mph": wind_mph,
                },
                observed_at=datetime.now(timezone.utc),
            )
        )
    return signals, {"status": "succeeded", "created_count": len(signals), "source": "open-meteo"}


def _fetch_event_signals(
    rental: Property,
    start_date: date,
    end_date: date,
) -> tuple[list[PricingDemandSignal], dict[str, Any]]:
    settings = get_settings()
    if not settings.ticketmaster_api_key:
        return [], {"status": "missing_key", "message": "Set TICKETMASTER_API_KEY for live events."}
    if rental.latitude is None or rental.longitude is None:
        return [], {"status": "skipped", "message": "Property latitude/longitude is required."}

    try:
        with httpx.Client(timeout=settings.demand_signal_http_timeout_seconds) as client:
            response = client.get(
                f"{settings.ticketmaster_base_url.rstrip('/')}/events.json",
                params={
                    "apikey": settings.ticketmaster_api_key,
                    "latlong": f"{float(rental.latitude)},{float(rental.longitude)}",
                    "radius": settings.ticketmaster_event_radius_miles,
                    "unit": "miles",
                    "startDateTime": f"{start_date.isoformat()}T00:00:00Z",
                    "endDateTime": f"{end_date.isoformat()}T23:59:59Z",
                    "size": 200,
                    "sort": "date,asc",
                },
            )
            response.raise_for_status()
            payload = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        return [], {"status": "failed", "message": str(exc)[:300]}

    events = ((payload.get("_embedded") or {}).get("events") or []) if isinstance(payload, dict) else []
    signals: list[PricingDemandSignal] = []
    for event in events:
        if not isinstance(event, dict):
            continue
        event_date = _ticketmaster_event_date(event)
        if event_date is None:
            continue
        name = str(event.get("name") or "Nearby event")
        segment = _ticketmaster_segment(event)
        demand_score = _event_demand_score(segment)
        signals.append(
            PricingDemandSignal(
                organization_id=rental.organization_id,
                property_id=rental.id,
                signal_type="area_event",
                label=name[:180],
                starts_on=event_date,
                ends_on=event_date,
                demand_score=demand_score,
                rate_impact_percent=None,
                confidence=0.72,
                source="ticketmaster",
                metadata_={
                    "provider_id": event.get("id"),
                    "url": event.get("url"),
                    "segment": segment,
                    "venue": _ticketmaster_venue(event),
                },
                observed_at=datetime.now(timezone.utc),
            )
        )
    return signals, {"status": "succeeded", "created_count": len(signals), "source": "ticketmaster"}


def _fetch_flight_signals(
    rental: Property,
    start_date: date,
    end_date: date,
) -> tuple[list[PricingDemandSignal], dict[str, Any]]:
    settings = get_settings()
    if settings.flight_demand_provider.lower() != "aviationstack":
        return [], {"status": "disabled", "message": "Set FLIGHT_DEMAND_PROVIDER=aviationstack."}
    if not settings.aviationstack_api_key:
        return [], {"status": "missing_key", "message": "Set AVIATIONSTACK_API_KEY for flights."}

    airport = _airport_iata_for_property(rental)
    if not airport:
        return [], {
            "status": "missing_airport",
            "message": "Set property metadata nearest_airport_iata or FLIGHT_DEMAND_DEFAULT_AIRPORT_IATA.",
        }

    max_days = max(1, min(settings.flight_demand_max_days, (end_date - start_date).days + 1))
    signals: list[PricingDemandSignal] = []
    errors: list[str] = []
    with httpx.Client(timeout=settings.demand_signal_http_timeout_seconds) as client:
        for offset in range(max_days):
            stay_date = start_date + timedelta(days=offset)
            try:
                response = client.get(
                    f"{settings.aviationstack_base_url.rstrip('/')}/flights",
                    params={
                        "access_key": settings.aviationstack_api_key,
                        "arr_iata": airport,
                        "flight_date": stay_date.isoformat(),
                        "limit": 100,
                    },
                )
                response.raise_for_status()
                payload = response.json()
            except (httpx.HTTPError, ValueError) as exc:
                errors.append(str(exc)[:180])
                continue
            arrivals = len(payload.get("data") or []) if isinstance(payload, dict) else 0
            demand_score, impact, label = _flight_demand_read(
                airport,
                arrivals,
                settings.flight_demand_busy_arrivals_per_day,
            )
            signals.append(
                PricingDemandSignal(
                    organization_id=rental.organization_id,
                    property_id=rental.id,
                    signal_type="flight",
                    label=label,
                    starts_on=stay_date,
                    ends_on=stay_date,
                    demand_score=demand_score,
                    rate_impact_percent=impact,
                    confidence=0.68,
                    source="aviationstack",
                    metadata_={"airport_iata": airport, "arrival_count": arrivals},
                    observed_at=datetime.now(timezone.utc),
                )
            )
    return signals, {
        "status": "succeeded" if signals else "failed",
        "created_count": len(signals),
        "source": "aviationstack",
        "airport_iata": airport,
        "errors": errors[:3],
    }


def _daily_value(daily: dict[str, Any], key: str, index: int) -> float | None:
    values = daily.get(key)
    if not isinstance(values, list) or index >= len(values):
        return None
    try:
        return float(values[index]) if values[index] is not None else None
    except (TypeError, ValueError):
        return None


def _weather_demand_read(
    code: float | None,
    temp_f: float | None,
    rain_pct: float | None,
    wind_mph: float | None,
) -> tuple[float, float, str]:
    rain = rain_pct or 0
    wind = wind_mph or 0
    temp = temp_f or 72
    storm_code = code is not None and code >= 95
    poor_travel = storm_code or rain >= 70 or wind >= 35
    great_weather = 68 <= temp <= 88 and rain <= 35 and wind <= 22 and not storm_code
    if poor_travel:
        return 0.25, -0.06, "Weather may slow travel"
    if great_weather:
        return 0.72, 0.045, "Great vacation weather"
    return 0.52, 0.005, "Normal weather outlook"


def _event_demand_score(segment: str | None) -> float:
    if not segment:
        return 0.62
    if segment.lower() in {"sports", "music"}:
        return 0.78
    if segment.lower() in {"arts & theatre", "miscellaneous"}:
        return 0.68
    return 0.62


def _flight_demand_read(
    airport: str,
    arrivals: int,
    busy_arrivals_per_day: int,
) -> tuple[float, float, str]:
    baseline = max(1, busy_arrivals_per_day)
    ratio = arrivals / baseline
    if ratio >= 1.2:
        return 0.84, 0.08, f"Heavy arrivals into {airport}"
    if ratio >= 0.8:
        return 0.65, 0.035, f"Steady arrivals into {airport}"
    return 0.36, -0.025, f"Light arrivals into {airport}"


def _ticketmaster_event_date(event: dict[str, Any]) -> date | None:
    start = event.get("dates", {}).get("start", {}) if isinstance(event.get("dates"), dict) else {}
    local_date = start.get("localDate") if isinstance(start, dict) else None
    try:
        return date.fromisoformat(local_date)
    except (TypeError, ValueError):
        return None


def _ticketmaster_segment(event: dict[str, Any]) -> str | None:
    classifications = event.get("classifications")
    if not isinstance(classifications, list) or not classifications:
        return None
    segment = classifications[0].get("segment") if isinstance(classifications[0], dict) else None
    name = segment.get("name") if isinstance(segment, dict) else None
    return str(name) if name else None


def _ticketmaster_venue(event: dict[str, Any]) -> str | None:
    venues = ((event.get("_embedded") or {}).get("venues") or []) if isinstance(event, dict) else []
    if not venues or not isinstance(venues[0], dict):
        return None
    name = venues[0].get("name")
    return str(name) if name else None


def _airport_iata_for_property(rental: Property) -> str | None:
    metadata = rental.metadata_ if isinstance(rental.metadata_, dict) else {}
    value = (
        metadata.get("nearest_airport_iata")
        or metadata.get("airport_iata")
        or get_settings().flight_demand_default_airport_iata
    )
    return str(value).strip().upper() if value else None
