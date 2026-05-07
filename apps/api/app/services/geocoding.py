from __future__ import annotations

import hashlib
from typing import Any

import httpx


def normalize_address(address: str) -> dict[str, str | float | None]:
    """Deterministic Phase 1 geocoder placeholder.

    Swap this for Google Maps, Mapbox, or Census geocoding. The stable pseudo
    coordinates let development flows exercise comp discovery without a paid key.
    """

    clean = " ".join(address.strip().split())
    digest = hashlib.sha256(clean.lower().encode()).hexdigest()
    lat_offset = int(digest[:6], 16) / 0xFFFFFF
    lng_offset = int(digest[6:12], 16) / 0xFFFFFF
    return {
        "formatted_address": clean,
        "address_line1": clean,
        "city": None,
        "region": None,
        "postal_code": None,
        "country_code": "US",
        "latitude": round(24.0 + lat_offset * 25.0, 6),
        "longitude": round(-124.0 + lng_offset * 57.0, 6),
    }


async def suggest_addresses(query: str, limit: int = 5) -> list[dict[str, str | float | None]]:
    clean = " ".join(query.strip().split())
    if len(clean) < 3:
        return []

    params = {
        "q": clean,
        "format": "jsonv2",
        "addressdetails": 1,
        "limit": max(1, min(limit, 8)),
        "countrycodes": "us",
    }
    headers = {
        "User-Agent": "RentalRadar.ai address autocomplete (support@rentalradar.ai)",
    }
    try:
        async with httpx.AsyncClient(timeout=4.5, headers=headers) as client:
            response = await client.get("https://nominatim.openstreetmap.org/search", params=params)
            response.raise_for_status()
            payload = response.json()
    except Exception:
        return []

    if not isinstance(payload, list):
        return []

    suggestions: list[dict[str, str | float | None]] = []
    seen: set[str] = set()
    for item in payload:
        if not isinstance(item, dict):
            continue
        suggestion = _nominatim_suggestion(item)
        formatted = str(suggestion["formatted_address"])
        if not formatted or formatted in seen:
            continue
        seen.add(formatted)
        suggestions.append(suggestion)
    return suggestions


def _nominatim_suggestion(item: dict[str, Any]) -> dict[str, str | float | None]:
    address = item.get("address") if isinstance(item.get("address"), dict) else {}
    house_number = address.get("house_number")
    road = address.get("road") or address.get("pedestrian") or address.get("residential")
    address_line1 = " ".join(str(part) for part in [house_number, road] if part) or None
    city = address.get("city") or address.get("town") or address.get("village") or address.get("hamlet")
    region = address.get("state")
    postal_code = address.get("postcode")
    country_code = str(address.get("country_code") or "us").upper()
    return {
        "place_id": str(item.get("place_id") or item.get("osm_id") or item.get("display_name") or ""),
        "formatted_address": str(item.get("display_name") or ""),
        "address_line1": str(address_line1) if address_line1 else None,
        "city": str(city) if city else None,
        "region": str(region) if region else None,
        "postal_code": str(postal_code) if postal_code else None,
        "country_code": country_code,
        "latitude": _float_or_none(item.get("lat")),
        "longitude": _float_or_none(item.get("lon")),
    }


def _float_or_none(value: Any) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None
