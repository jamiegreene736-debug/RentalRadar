from __future__ import annotations

import hashlib


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
