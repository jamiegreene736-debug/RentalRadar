from __future__ import annotations

from datetime import date, datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field, HttpUrl, field_validator

from app.db.models import PmsProvider, ScrapeSource


class AddressPropertyCreate(BaseModel):
    address: str = Field(min_length=6)
    name: str | None = None
    bedrooms: int | None = Field(default=None, ge=0)
    bathrooms: float | None = Field(default=None, ge=0)
    sleeps: int | None = Field(default=None, ge=0)
    property_type: str | None = None
    base_price_cents: int | None = Field(default=None, ge=0)
    min_price_cents: int | None = Field(default=None, ge=0)
    max_price_cents: int | None = Field(default=None, ge=0)
    comp_urls: list[HttpUrl] = Field(default_factory=list)
    scan_days: int = Field(default=90, ge=1, le=365)

    @field_validator("max_price_cents")
    @classmethod
    def validate_price_bounds(cls, value: int | None, info: Any) -> int | None:
        min_price = info.data.get("min_price_cents")
        if min_price is not None and value is not None and value < min_price:
            raise ValueError("max_price_cents must be >= min_price_cents")
        return value


class PropertyResponse(BaseModel):
    id: UUID
    organization_id: UUID
    name: str | None
    formatted_address: str | None
    address_line1: str
    bedrooms: int | None
    bathrooms: float | None
    sleeps: int | None
    market_scan_job_ids: list[UUID]


class RateObservationResponse(BaseModel):
    id: UUID
    source: ScrapeSource
    competitor_id: UUID | None
    stay_date: date
    nightly_rate_cents: int | None
    total_rate_cents: int | None
    available: bool | None
    extraction_confidence: float | None
    observed_at: datetime


class PricingRecommendationResponse(BaseModel):
    id: UUID
    stay_date: date
    current_rate_cents: int | None
    recommended_rate_cents: int
    recommended_min_stay: int | None = None
    discount_percent: float | None = None
    confidence: float | None
    status: str
    reason: dict[str, Any]


class MarketRatesResponse(BaseModel):
    property_id: UUID
    cached: bool
    observations: list[RateObservationResponse]
    recommendations: list[PricingRecommendationResponse]


class PmsConnectRequest(BaseModel):
    provider: PmsProvider
    account_ref: str | None = None
    display_name: str | None = None
    api_key: str | None = None
    access_token: str | None = None
    refresh_token: str | None = None
    username: str | None = None
    password: str | None = None
    client_id: str | None = None
    client_secret: str | None = None
    webhook_secret: str | None = None
    oauth_code: str | None = None
    redirect_uri: str | None = None
    scopes: list[str] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)


class PmsConnectResponse(BaseModel):
    id: UUID
    provider: PmsProvider
    account_ref: str | None
    status: str
    credential_fingerprint: str | None = None
    validation: dict[str, Any] = Field(default_factory=dict)
    credential_rotation_required: bool = False


class PropertyPmsMappingRequest(BaseModel):
    property_id: UUID
    pms_connection_id: UUID
    external_property_id: str
    external_channel_ids: dict[str, Any] = Field(default_factory=dict)


class PropertyPmsMappingResponse(BaseModel):
    id: UUID
    property_id: UUID
    pms_connection_id: UUID
    external_property_id: str
    active: bool


class PmsSyncRequest(BaseModel):
    property_id: UUID
    pms_connection_id: UUID
    start_date: date
    end_date: date
    direction: str = Field(default="pull_rates", pattern="^(pull_rates|two_way)$")
    rates: list["PricingPushItem"] = Field(default_factory=list)


class PmsSyncResponse(BaseModel):
    status: str
    pulled_count: int = 0
    pushed_count: int = 0
    fallback_used: bool = False
    detail: dict[str, Any] = Field(default_factory=dict)


class PublicListingBaselineRequest(BaseModel):
    property_id: UUID
    public_listing_urls: list[HttpUrl] = Field(min_length=1, max_length=10)


class PublicListingBaselineResponse(BaseModel):
    queued_job_ids: list[UUID]
    legal_notice: str


class PricingPushItem(BaseModel):
    stay_date: date
    rate_cents: int = Field(ge=0)
    pricing_recommendation_id: UUID | None = None


class PricingPushRequest(BaseModel):
    property_id: UUID
    pms_connection_id: UUID | None = None
    channels: list[str] = Field(default_factory=list)
    rates: list[PricingPushItem] = Field(min_length=1)


class PricingPushResponse(BaseModel):
    queued_push_ids: list[UUID]
    task_id: str


class PricingRunRequest(BaseModel):
    property_id: UUID
    start_date: date | None = None
    end_date: date | None = None


class PricingRunResponse(BaseModel):
    property_id: UUID
    recommendation_count: int
    recommendations: list[PricingRecommendationResponse]


class PricingExperimentCreate(BaseModel):
    property_id: UUID | None = None
    name: str = Field(min_length=3)
    hypothesis: str | None = None
    status: str = Field(default="running", pattern="^(draft|running|paused|completed|canceled)$")
    variants: dict[str, dict[str, Any]] = Field(
        default_factory=lambda: {
            "control": {"rate_multiplier": 1.0, "min_stay_delta": 0, "discount_delta": 0},
            "live_aggressive": {"rate_multiplier": 1.04, "min_stay_delta": 0, "discount_delta": 0},
        }
    )
    traffic_split: dict[str, float] = Field(default_factory=lambda: {"control": 0.5, "live_aggressive": 0.5})
    primary_metric: str = "revpar"


class PricingExperimentResponse(BaseModel):
    id: UUID
    property_id: UUID | None
    name: str
    status: str
    variants: dict[str, Any]
    traffic_split: dict[str, float]


class PricingPerformanceCreate(BaseModel):
    property_id: UUID
    pricing_recommendation_id: UUID | None = None
    experiment_assignment_id: UUID | None = None
    stay_date: date
    booked: bool = False
    booked_at: datetime | None = None
    realized_rate_cents: int | None = Field(default=None, ge=0)
    revenue_cents: int | None = Field(default=None, ge=0)
    occupancy_status: str = Field(default="unknown", pattern="^(unknown|available|held|booked|blocked)$")
    channel: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class PricingPerformanceResponse(BaseModel):
    id: UUID
    property_id: UUID
    stay_date: date
    booked: bool
    revenue_cents: int | None


class PricingExperimentResultsResponse(BaseModel):
    experiment_id: UUID
    variants: dict[str, dict[str, Any]]


class LocalEventCreate(BaseModel):
    property_id: UUID | None = None
    name: str = Field(min_length=2)
    category: str | None = None
    starts_on: date
    ends_on: date
    distance_km: float | None = Field(default=None, ge=0)
    demand_score: float = Field(default=0.5, ge=0, le=1)
    source: str = "manual"
    metadata: dict[str, Any] = Field(default_factory=dict)


class LocalEventResponse(BaseModel):
    id: UUID
    name: str
    starts_on: date
    ends_on: date
    demand_score: float


class OccupancySignalCreate(BaseModel):
    property_id: UUID
    stay_date: date
    property_occupancy: float | None = Field(default=None, ge=0, le=1)
    market_occupancy: float | None = Field(default=None, ge=0, le=1)
    pacing_ratio: float | None = None
    pickup_7d: int | None = None
    pickup_30d: int | None = None
    source: str = "pms"
    metadata: dict[str, Any] = Field(default_factory=dict)


class OccupancySignalResponse(BaseModel):
    id: UUID
    property_id: UUID
    stay_date: date
    property_occupancy: float | None
    market_occupancy: float | None
    pacing_ratio: float | None


class BillingCheckoutRequest(BaseModel):
    plan_code: str = Field(default="starter_3", min_length=3)
    property_quantity: int = Field(default=1, ge=1, le=5000)


class BillingPortalRequest(BaseModel):
    return_url: str | None = None


class BillingSessionResponse(BaseModel):
    url: str
    mode: str | None = None
    session_id: str | None = None


class UsagePlanSummary(BaseModel):
    code: str
    name: str
    free_tier: bool
    monthly_price_cents: int
    max_compute_units_per_month: int
    max_jobs_per_day: int
    max_scrapes_per_property_month: int


class UsageCounters(BaseModel):
    compute_units_month: int
    jobs_today: int
    period_start: datetime
    next_reset_estimate: datetime


class UsageSummaryResponse(BaseModel):
    plan: UsagePlanSummary
    usage: UsageCounters


class ErrorDashboardItem(BaseModel):
    id: UUID | str
    source: str
    status: str
    message: str | None = None
    created_at: datetime | None = None
    detail: dict[str, Any] = Field(default_factory=dict)


class ErrorDashboardResponse(BaseModel):
    counts: dict[str, int]
    recent_errors: list[ErrorDashboardItem]


class ScrapingLegalNoticeResponse(BaseModel):
    title: str
    body: str
    commitments: list[str]
    user_responsibilities: list[str]
