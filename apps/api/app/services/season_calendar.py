from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from app.db.models import Property


@dataclass(frozen=True)
class SeasonBand:
    code: str
    label: str
    months: list[int]
    multiplier: float
    minimum_stay_nights: int
    booking_posture: str
    notes: str


@dataclass(frozen=True)
class HolidayWindow:
    label: str
    date_window: str
    multiplier: float
    minimum_stay_nights: int
    notes: str


@dataclass(frozen=True)
class MarketSeasonProfile:
    property_id: UUID
    market_key: str
    market_label: str
    basis: str
    seasons: list[SeasonBand]
    holidays: list[HolidayWindow]
    current_model_note: str


MONTH_LABELS = {
    1: "Jan",
    2: "Feb",
    3: "Mar",
    4: "Apr",
    5: "May",
    6: "Jun",
    7: "Jul",
    8: "Aug",
    9: "Sep",
    10: "Oct",
    11: "Nov",
    12: "Dec",
}


def season_profile_for_property(rental: Property) -> MarketSeasonProfile:
    market_key, market_label = _infer_market(rental)
    profile = _profiles()[market_key]
    return MarketSeasonProfile(
        property_id=rental.id,
        market_key=market_key,
        market_label=market_label,
        basis=profile["basis"],
        seasons=profile["seasons"],
        holidays=profile["holidays"],
        current_model_note=(
            "Current scan windows still use calendar Winter/Spring/Summer/Fall labels. "
            "This season calendar is the market-specific revenue definition that should feed "
            "future scan scheduling, min-stay rules, and holiday overrides."
        ),
    )


def month_names(months: list[int]) -> list[str]:
    return [MONTH_LABELS[month] for month in months]


def _infer_market(rental: Property) -> tuple[str, str]:
    address = " ".join(
        str(value or "")
        for value in (
            rental.formatted_address,
            rental.address_line1,
            rental.city,
            rental.region,
            rental.country_code,
        )
    ).lower()
    if any(token in address for token in ("osceola", "orlando", "kissimmee", "davenport", "florida", " fl")):
        return "central_florida", "Central Florida / Orlando"
    if any(token in address for token in ("kauai", "maui", "oahu", "honolulu", "hawaii", " hi")):
        return "hawaii", "Hawaii"
    if any(token in address for token in ("myrtle", "panama city", "destin", "outer banks", "beach")):
        return "coastal_beach", "Coastal Beach"
    return "national_default", "Default vacation-rental market"


def _profiles() -> dict[str, dict[str, object]]:
    return {
        "central_florida": {
            "basis": "Theme-park and school-break demand around Orlando/Kissimmee.",
            "seasons": [
                SeasonBand(
                    code="low",
                    label="Low season",
                    months=[1, 2, 9, 11],
                    multiplier=0.92,
                    minimum_stay_nights=2,
                    booking_posture="Keep conversion friction low and protect only strong weekends.",
                    notes="January, February, September, and non-holiday November are softer in this template.",
                ),
                SeasonBand(
                    code="middle",
                    label="Middle season",
                    months=[4, 5, 8, 10],
                    multiplier=1.03,
                    minimum_stay_nights=3,
                    booking_posture="Balanced rates with selective weekend and event premiums.",
                    notes="Shoulder months can move quickly when school calendars or events compress supply.",
                ),
                SeasonBand(
                    code="high",
                    label="High season",
                    months=[3, 6, 7, 12],
                    multiplier=1.16,
                    minimum_stay_nights=4,
                    booking_posture="Hold stronger ADR farther out and avoid cheap prime-week bookings.",
                    notes="Spring break, summer travel, and December demand carry the high-season baseline.",
                ),
            ],
            "holidays": [
                HolidayWindow("Spring break", "Mid Mar - early Apr", 1.24, 5, "Treat as event/holiday even when April is otherwise middle season."),
                HolidayWindow("Independence Day", "Jul 1 - Jul 7", 1.22, 4, "Keep July holiday compression above normal summer pricing."),
                HolidayWindow("Thanksgiving", "Thanksgiving week", 1.18, 4, "November is low season except the holiday week."),
                HolidayWindow("Christmas / New Year", "Dec 20 - Jan 3", 1.32, 5, "Highest template premium; protect before discounting."),
            ],
        },
        "hawaii": {
            "basis": "Island demand shaped by winter escapes, summer family travel, and airlift.",
            "seasons": [
                SeasonBand("low", "Low season", [4, 5, 9, 10, 11], 0.95, 3, "Use value pricing on weekdays and fill clean gaps.", "Fall shoulder periods are softer unless an island event compresses supply."),
                SeasonBand("middle", "Middle season", [6, 8], 1.05, 4, "Balance family-travel demand with market occupancy.", "June and August often need pacing checks rather than static premiums."),
                SeasonBand("high", "High season", [1, 2, 3, 7, 12], 1.18, 5, "Protect peak ADR and minimum stays farther in advance.", "Winter, July, and December carry the high-season baseline."),
            ],
            "holidays": [
                HolidayWindow("Presidents / winter break", "Mid Feb", 1.20, 5, "Winter demand can outperform the monthly baseline."),
                HolidayWindow("Independence Day", "Jul 1 - Jul 7", 1.18, 5, "Protect peak summer week."),
                HolidayWindow("Thanksgiving", "Thanksgiving week", 1.16, 5, "Holiday travel can override shoulder-season softness."),
                HolidayWindow("Christmas / New Year", "Dec 18 - Jan 5", 1.34, 7, "Highest holiday premium and longest stay control."),
            ],
        },
        "coastal_beach": {
            "basis": "Drive-to beach demand with summer peak and shoulder-season weather sensitivity.",
            "seasons": [
                SeasonBand("low", "Low season", [1, 2, 11, 12], 0.88, 2, "Convert opportunistic stays and avoid rigid LOS rules.", "Winter is soft outside holiday travel."),
                SeasonBand("middle", "Middle season", [3, 4, 5, 9, 10], 1.02, 3, "Use weekend premiums and monitor weather/event compression.", "Spring and fall are shoulder periods."),
                SeasonBand("high", "High season", [6, 7, 8], 1.22, 5, "Hold weekly or longer stays where the market supports it.", "Summer is the primary revenue season."),
            ],
            "holidays": [
                HolidayWindow("Memorial Day", "Memorial Day weekend", 1.18, 4, "Start summer protections before June."),
                HolidayWindow("Independence Day", "Jul 1 - Jul 7", 1.28, 5, "Peak compression week."),
                HolidayWindow("Labor Day", "Labor Day weekend", 1.18, 4, "End-of-summer holiday premium."),
                HolidayWindow("Christmas / New Year", "Dec 22 - Jan 2", 1.15, 3, "Holiday travel can outperform normal low season."),
            ],
        },
        "national_default": {
            "basis": "Generic vacation-rental template used until a property maps to a stronger local market profile.",
            "seasons": [
                SeasonBand("low", "Low season", [1, 2, 9, 11], 0.92, 2, "Prioritize conversion and gap fills.", "Default soft-demand months."),
                SeasonBand("middle", "Middle season", [3, 4, 5, 10], 1.02, 3, "Balanced rate posture.", "Default shoulder months."),
                SeasonBand("high", "High season", [6, 7, 8, 12], 1.15, 4, "Protect peak dates before lowering.", "Default peak travel months."),
            ],
            "holidays": [
                HolidayWindow("Spring break", "Market school-break weeks", 1.16, 4, "Needs local school-calendar refinement."),
                HolidayWindow("Independence Day", "Jul 1 - Jul 7", 1.18, 4, "Default summer holiday premium."),
                HolidayWindow("Thanksgiving", "Thanksgiving week", 1.14, 3, "Holiday override."),
                HolidayWindow("Christmas / New Year", "Dec 20 - Jan 3", 1.24, 5, "Default highest holiday premium."),
            ],
        },
    }
