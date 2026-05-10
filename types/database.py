from __future__ import annotations

from datetime import date, datetime
from enum import Enum
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


JsonValue = dict[str, Any] | list[Any] | str | int | float | bool | None


class CamelModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, from_attributes=True)


class UserRole(str, Enum):
    owner = "owner"
    admin = "admin"
    analyst = "analyst"
    readonly = "readonly"


class SubscriptionStatus(str, Enum):
    trialing = "trialing"
    active = "active"
    past_due = "past_due"
    paused = "paused"
    canceled = "canceled"
    incomplete = "incomplete"
    incomplete_expired = "incomplete_expired"


class PropertySubscriptionStatus(str, Enum):
    active = "active"
    paused = "paused"
    canceled = "canceled"
    past_due = "past_due"


class ScrapeSource(str, Enum):
    airbnb = "airbnb"
    vrbo = "vrbo"
    booking = "booking"
    direct_pms = "direct_pms"
    guesty = "guesty"
    hostaway = "hostaway"
    ownerrez = "ownerrez"
    manual = "manual"
    other = "other"


class ScrapeJobStatus(str, Enum):
    queued = "queued"
    running = "running"
    succeeded = "succeeded"
    failed = "failed"
    canceled = "canceled"
    needs_review = "needs_review"


class AgentTrainingStatus(str, Enum):
    candidate = "candidate"
    validating = "validating"
    approved = "approved"
    rejected = "rejected"
    retired = "retired"


class PricingRecommendationStatus(str, Enum):
    draft = "draft"
    pending_approval = "pending_approval"
    approved = "approved"
    rejected = "rejected"
    pushed = "pushed"
    superseded = "superseded"


class PmsConnectionStatus(str, Enum):
    connected = "connected"
    needs_reauth = "needs_reauth"
    disabled = "disabled"
    revoked = "revoked"
    error = "error"


class PmsProvider(str, Enum):
    guesty = "guesty"
    hostaway = "hostaway"
    streamline = "streamline"
    ciirus = "ciirus"
    ownerrez = "ownerrez"
    lodgify = "lodgify"
    hostfully = "hostfully"
    airbnb = "airbnb"
    vrbo = "vrbo"
    booking = "booking"
    direct = "direct"
    other = "other"


class Organization(CamelModel):
    id: UUID
    name: str
    slug: str | None = None
    stripe_customer_id: str | None = None
    billing_email: str | None = None
    created_at: datetime
    updated_at: datetime


class AppUser(CamelModel):
    id: UUID
    email: str
    first_name: str | None = None
    last_name: str | None = None
    full_name: str | None = None
    avatar_url: str | None = None
    phone_number: str | None = None
    company_name: str | None = None
    job_title: str | None = None
    timezone: str = "America/New_York"
    locale: str = "en-US"
    notification_email: str | None = None
    marketing_opt_in: bool = False
    profile_completed_at: datetime | None = None
    clerk_user_id: str | None = None
    supabase_auth_user_id: UUID | None = None
    default_organization_id: UUID | None = None
    created_at: datetime
    updated_at: datetime


class Property(CamelModel):
    id: UUID
    organization_id: UUID
    name: str | None = None
    address_line1: str
    address_line2: str | None = None
    city: str | None = None
    region: str | None = None
    postal_code: str | None = None
    country_code: str = "US"
    formatted_address: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    bedrooms: int | None = None
    bathrooms: float | None = None
    sleeps: int | None = None
    property_type: str | None = None
    timezone: str = "America/New_York"
    currency_code: str = "USD"
    base_price_cents: int | None = None
    min_price_cents: int | None = None
    max_price_cents: int | None = None
    active: bool = True
    metadata: JsonValue = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime


class PropertyCreate(CamelModel):
    organization_id: UUID
    address_line1: str
    name: str | None = None
    address_line2: str | None = None
    city: str | None = None
    region: str | None = None
    postal_code: str | None = None
    country_code: str = "US"
    bedrooms: int | None = None
    bathrooms: float | None = None
    sleeps: int | None = None
    base_price_cents: int | None = None
    min_price_cents: int | None = None
    max_price_cents: int | None = None


class SubscriptionPlan(CamelModel):
    id: UUID
    code: str
    name: str
    monthly_price_cents: int
    stripe_price_id: str | None = None
    max_scrapes_per_property_month: int
    max_competitors_per_property: int
    supports_pms_push: bool
    free_tier: bool = False
    max_compute_units_per_month: int = 10000
    max_jobs_per_day: int = 200
    metadata: JsonValue
    active: bool
    created_at: datetime
    updated_at: datetime


class OrganizationSubscription(CamelModel):
    id: UUID
    organization_id: UUID
    stripe_subscription_id: str | None = None
    stripe_customer_id: str | None = None
    status: SubscriptionStatus
    current_period_start: datetime | None = None
    current_period_end: datetime | None = None
    cancel_at_period_end: bool
    created_at: datetime
    updated_at: datetime


class PropertySubscription(CamelModel):
    id: UUID
    organization_subscription_id: UUID | None = None
    property_id: UUID
    plan_id: UUID
    stripe_subscription_item_id: str | None = None
    status: PropertySubscriptionStatus
    monthly_price_cents: int
    starts_at: datetime
    ends_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class UsageEvent(CamelModel):
    id: UUID
    organization_id: UUID
    property_id: UUID | None = None
    event_type: str
    compute_units: int
    source: str
    idempotency_key: str | None = None
    metadata: JsonValue
    created_at: datetime


class BillingEvent(CamelModel):
    id: UUID
    organization_id: UUID | None = None
    stripe_event_id: str | None = None
    event_type: str
    processed: bool
    payload: JsonValue
    error_message: str | None = None
    created_at: datetime


class CompSet(CamelModel):
    id: UUID
    property_id: UUID
    name: str
    search_radius_km: float | None = None
    bedrooms_min: int | None = None
    bedrooms_max: int | None = None
    sleeps_min: int | None = None
    sleeps_max: int | None = None
    active: bool
    selection_rules: JsonValue
    created_at: datetime
    updated_at: datetime


class Competitor(CamelModel):
    id: UUID
    comp_set_id: UUID
    property_id: UUID
    source: ScrapeSource
    external_id: str | None = None
    external_url: str
    canonical_url: str | None = None
    title: str | None = None
    address: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    bedrooms: int | None = None
    bathrooms: float | None = None
    sleeps: int | None = None
    rating: float | None = None
    review_count: int | None = None
    similarity_score: float | None = None
    active: bool
    metadata: JsonValue
    created_at: datetime
    updated_at: datetime


class PmsConnection(CamelModel):
    id: UUID
    organization_id: UUID
    provider: PmsProvider
    account_ref: str | None = None
    display_name: str | None = None
    status: PmsConnectionStatus
    access_token_encrypted: str | None = None
    refresh_token_encrypted: str | None = None
    credentials_encrypted: JsonValue | None = None
    webhook_secret_encrypted: str | None = None
    credential_fingerprint: str | None = None
    credentials_version: int = 1
    token_cipher: str
    token_expires_at: datetime | None = None
    scopes: list[str]
    last_verified_at: datetime | None = None
    last_sync_at: datetime | None = None
    error_message: str | None = None
    metadata: JsonValue
    created_at: datetime
    updated_at: datetime


class PmsSyncRun(CamelModel):
    id: UUID
    organization_id: UUID
    pms_connection_id: UUID
    property_id: UUID | None = None
    direction: str
    provider: str
    status: str
    fallback_used: bool
    started_at: datetime | None = None
    completed_at: datetime | None = None
    pulled_count: int
    pushed_count: int
    skipped_count: int
    error_message: str | None = None
    request_summary: JsonValue
    response_summary: JsonValue
    created_at: datetime


class ScraperStrategy(CamelModel):
    id: UUID
    source: ScrapeSource
    domain: str
    layout_fingerprint: str
    strategy_json: JsonValue
    version: int
    success_rate: float
    active: bool
    created_by_agent: str | None = None
    approved_by_user_id: UUID | None = None
    created_at: datetime
    updated_at: datetime


class ScrapeJob(CamelModel):
    id: UUID
    organization_id: UUID
    property_id: UUID | None = None
    competitor_id: UUID | None = None
    scraper_strategy_id: UUID | None = None
    source: ScrapeSource
    target_url: str
    stay_date_start: date | None = None
    stay_date_end: date | None = None
    status: ScrapeJobStatus
    priority: int
    attempts: int
    max_attempts: int
    locked_by: str | None = None
    locked_at: datetime | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    error_code: str | None = None
    error_message: str | None = None
    request_context: JsonValue
    result_summary: JsonValue
    created_at: datetime
    updated_at: datetime


class ScrapeJobLog(CamelModel):
    id: int
    scrape_job_id: UUID
    level: str
    event: str
    message: str | None = None
    payload: JsonValue
    created_at: datetime


class RateObservation(CamelModel):
    id: UUID
    property_id: UUID
    competitor_id: UUID | None = None
    scrape_job_id: UUID | None = None
    scrape_snapshot_id: UUID | None = None
    source: ScrapeSource
    stay_date: date
    currency_code: str
    nightly_rate_cents: int | None = None
    total_rate_cents: int | None = None
    fees_cents: int | None = None
    taxes_cents: int | None = None
    available: bool | None = None
    min_nights: int | None = None
    max_nights: int | None = None
    cancellation_policy: str | None = None
    extraction_confidence: float | None = None
    observed_at: datetime
    raw_payload: JsonValue
    created_at: datetime


class PricingRecommendation(CamelModel):
    id: UUID
    property_id: UUID
    stay_date: date
    currency_code: str
    current_rate_cents: int | None = None
    recommended_rate_cents: int
    min_rate_cents: int | None = None
    max_rate_cents: int | None = None
    confidence: float | None = None
    recommended_min_stay: int | None = None
    discount_percent: float | None = None
    status: PricingRecommendationStatus
    model_version: str
    comp_set_id: UUID | None = None
    reason: JsonValue
    approved_by_user_id: UUID | None = None
    approved_at: datetime | None = None
    superseded_by_id: UUID | None = None
    created_at: datetime
    updated_at: datetime


class LocalEvent(CamelModel):
    id: UUID
    organization_id: UUID
    property_id: UUID | None = None
    name: str
    category: str | None = None
    starts_on: date
    ends_on: date
    distance_km: float | None = None
    demand_score: float
    source: str
    metadata: JsonValue
    created_at: datetime
    updated_at: datetime


class OccupancySignal(CamelModel):
    id: UUID
    property_id: UUID
    stay_date: date
    property_occupancy: float | None = None
    market_occupancy: float | None = None
    pacing_ratio: float | None = None
    pickup_7d: int | None = None
    pickup_30d: int | None = None
    source: str
    metadata: JsonValue
    observed_at: datetime
    created_at: datetime


class PricingExperiment(CamelModel):
    id: UUID
    organization_id: UUID
    property_id: UUID | None = None
    name: str
    status: str
    hypothesis: str | None = None
    variants: JsonValue
    traffic_split: JsonValue
    primary_metric: str
    started_at: datetime | None = None
    ended_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class PricingExperimentAssignment(CamelModel):
    id: UUID
    experiment_id: UUID
    property_id: UUID
    pricing_recommendation_id: UUID | None = None
    stay_date: date
    variant_key: str
    assigned_rate_cents: int
    assigned_min_stay: int | None = None
    assigned_discount_percent: float | None = None
    assignment_context: JsonValue
    created_at: datetime


class PricingPerformanceEvent(CamelModel):
    id: UUID
    property_id: UUID
    pricing_recommendation_id: UUID | None = None
    experiment_assignment_id: UUID | None = None
    stay_date: date
    booked: bool
    booked_at: datetime | None = None
    realized_rate_cents: int | None = None
    revenue_cents: int | None = None
    occupancy_status: str
    channel: str | None = None
    metadata: JsonValue
    created_at: datetime


class AgentTrainingRun(CamelModel):
    id: UUID
    scrape_job_id: UUID | None = None
    scraper_strategy_id: UUID | None = None
    source: ScrapeSource
    domain: str
    layout_fingerprint: str | None = None
    agent_name: str
    model_name: str | None = None
    prompt_version: str | None = None
    status: AgentTrainingStatus
    input_snapshot_url: str | None = None
    input_dom_url: str | None = None
    generated_strategy_json: JsonValue | None = None
    validation_report: JsonValue
    confidence: float | None = None
    token_usage: JsonValue
    error_message: str | None = None
    started_at: datetime
    completed_at: datetime | None = None
    created_at: datetime
