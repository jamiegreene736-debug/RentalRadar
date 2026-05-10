from __future__ import annotations

from typing import Any

from app.db.models import Property

PRICING_CONTROL_KEY = "pricing_controls"

CONTROL_DEFAULTS: dict[str, Any] = {
    "absolute_min_price_cents": None,
    "global_min_stay": 2,
    "weekday_min_stay": 2,
    "weekend_min_stay": 3,
    "gap_night_min_stay": 1,
    "gap_night_discount_percent": 10.0,
    "last_minute_window_days": 14,
    "last_minute_discount_percent": 12.0,
    "far_future_window_days": 180,
    "far_future_premium_percent": 8.0,
    "orphan_gap_enabled": True,
    "seasonal_rules_enabled": True,
    "event_rules_enabled": True,
    "pacing_adjustments_enabled": True,
    "review_adjustments_enabled": True,
    "availability_yielding_enabled": False,
    "channel_fee_preview_enabled": False,
}


def pricing_controls_for_property(rental: Property) -> dict[str, Any]:
    saved = _saved_controls(rental)
    return {
        "base_price_cents": rental.base_price_cents,
        "min_price_cents": rental.min_price_cents,
        "max_price_cents": rental.max_price_cents,
        **CONTROL_DEFAULTS,
        **saved,
    }


def apply_pricing_control_update(rental: Property, updates: dict[str, Any]) -> dict[str, Any]:
    direct_fields = {"base_price_cents", "min_price_cents", "max_price_cents"}
    for field in direct_fields:
        if field in updates:
            setattr(rental, field, updates[field])

    current = pricing_controls_for_property(rental)
    proposed = {**current, **updates}
    _validate_bounds(proposed)

    metadata = dict(rental.metadata_ or {})
    saved = {**_saved_controls(rental)}
    for key, value in updates.items():
        if key not in direct_fields:
            saved[key] = value
    metadata[PRICING_CONTROL_KEY] = saved
    rental.metadata_ = metadata
    return pricing_controls_for_property(rental)


def _saved_controls(rental: Property) -> dict[str, Any]:
    metadata = rental.metadata_ if isinstance(rental.metadata_, dict) else {}
    controls = metadata.get(PRICING_CONTROL_KEY)
    return controls if isinstance(controls, dict) else {}


def _validate_bounds(values: dict[str, Any]) -> None:
    minimum = values.get("min_price_cents")
    maximum = values.get("max_price_cents")
    absolute_minimum = values.get("absolute_min_price_cents")
    if minimum is not None and maximum is not None and maximum < minimum:
        raise ValueError("Ceiling price must be greater than or equal to the floor price.")
    if absolute_minimum is not None and minimum is not None and absolute_minimum > minimum:
        raise ValueError("Absolute minimum must be less than or equal to the floor price.")
