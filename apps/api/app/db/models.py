from __future__ import annotations

import enum
from datetime import date, datetime
from uuid import UUID, uuid4

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    LargeBinary,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID as PG_UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy.sql import func


class Base(DeclarativeBase):
    pass


class ScrapeSource(str, enum.Enum):
    airbnb = "airbnb"
    vrbo = "vrbo"
    booking = "booking"
    direct_pms = "direct_pms"
    guesty = "guesty"
    hostaway = "hostaway"
    ownerrez = "ownerrez"
    manual = "manual"
    other = "other"


class ScrapeJobStatus(str, enum.Enum):
    queued = "queued"
    running = "running"
    succeeded = "succeeded"
    failed = "failed"
    canceled = "canceled"
    needs_review = "needs_review"


class PricingRecommendationStatus(str, enum.Enum):
    draft = "draft"
    pending_approval = "pending_approval"
    approved = "approved"
    rejected = "rejected"
    pushed = "pushed"
    superseded = "superseded"


class PmsConnectionStatus(str, enum.Enum):
    connected = "connected"
    needs_reauth = "needs_reauth"
    disabled = "disabled"
    revoked = "revoked"
    error = "error"


class PmsProvider(str, enum.Enum):
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


class OtaDirectPlatform(str, enum.Enum):
    airbnb = "airbnb"
    vrbo = "vrbo"
    booking = "booking"


class OtaDirectStatus(str, enum.Enum):
    pending = "pending"
    active = "active"
    two_fa_required = "2fa_required"
    failed = "failed"
    revoked = "revoked"


class AgentTrainingStatus(str, enum.Enum):
    candidate = "candidate"
    validating = "validating"
    approved = "approved"
    rejected = "rejected"
    retired = "retired"


scrape_source_enum = Enum(ScrapeSource, name="scrape_source", create_type=False)
scrape_job_status_enum = Enum(ScrapeJobStatus, name="scrape_job_status", create_type=False)
recommendation_status_enum = Enum(
    PricingRecommendationStatus,
    name="pricing_recommendation_status",
    create_type=False,
)
pms_status_enum = Enum(PmsConnectionStatus, name="pms_connection_status", create_type=False)
pms_provider_enum = Enum(PmsProvider, name="pms_provider", create_type=False)
ota_direct_platform_enum = Enum(OtaDirectPlatform, name="ota_direct_platform", create_type=False)
ota_direct_status_enum = Enum(
    OtaDirectStatus,
    name="ota_direct_status",
    create_type=False,
    values_callable=lambda values: [item.value for item in values],
)
agent_training_status_enum = Enum(
    AgentTrainingStatus,
    name="agent_training_status",
    create_type=False,
)
subscription_status_enum = Enum(
    "trialing",
    "active",
    "past_due",
    "paused",
    "canceled",
    "incomplete",
    "incomplete_expired",
    name="subscription_status",
    create_type=False,
)
property_subscription_status_enum = Enum(
    "active",
    "paused",
    "canceled",
    "past_due",
    name="property_subscription_status",
    create_type=False,
)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )


class Organization(Base, TimestampMixin):
    __tablename__ = "organizations"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    name: Mapped[str] = mapped_column(Text)
    slug: Mapped[str | None] = mapped_column(Text)
    stripe_customer_id: Mapped[str | None] = mapped_column(Text)
    billing_email: Mapped[str | None] = mapped_column(Text)

    properties: Mapped[list[Property]] = relationship(back_populates="organization")
    members: Mapped[list[OrganizationMember]] = relationship(back_populates="organization")


class AppUser(Base, TimestampMixin):
    __tablename__ = "app_users"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    email: Mapped[str] = mapped_column(Text, unique=True)
    full_name: Mapped[str | None] = mapped_column(Text)
    default_organization_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="SET NULL"),
        index=True,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_login: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    default_organization: Mapped[Organization | None] = relationship(
        "Organization",
        foreign_keys=[default_organization_id],
    )
    memberships: Mapped[list[OrganizationMember]] = relationship(back_populates="user")


class OrganizationMember(Base, TimestampMixin):
    __tablename__ = "organization_members"
    __table_args__ = (UniqueConstraint("organization_id", "user_id"),)

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    organization_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        index=True,
    )
    user_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("app_users.id", ondelete="CASCADE"),
        index=True,
    )
    role: Mapped[str] = mapped_column(Text, default="member")

    organization: Mapped[Organization] = relationship(back_populates="members")
    user: Mapped[AppUser] = relationship(back_populates="memberships")


class Property(Base, TimestampMixin):
    __tablename__ = "properties"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    organization_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        index=True,
    )
    name: Mapped[str | None] = mapped_column(Text)
    address_line1: Mapped[str] = mapped_column(Text)
    address_line2: Mapped[str | None] = mapped_column(Text)
    city: Mapped[str | None] = mapped_column(Text)
    region: Mapped[str | None] = mapped_column(Text)
    postal_code: Mapped[str | None] = mapped_column(Text)
    country_code: Mapped[str] = mapped_column(String(2), default="US")
    formatted_address: Mapped[str | None] = mapped_column(Text)
    latitude: Mapped[float | None] = mapped_column(Numeric(9, 6))
    longitude: Mapped[float | None] = mapped_column(Numeric(9, 6))
    bedrooms: Mapped[int | None] = mapped_column(Integer)
    bathrooms: Mapped[float | None] = mapped_column(Numeric(4, 1))
    sleeps: Mapped[int | None] = mapped_column(Integer)
    property_type: Mapped[str | None] = mapped_column(Text)
    timezone: Mapped[str] = mapped_column(Text, default="America/New_York")
    currency_code: Mapped[str] = mapped_column(String(3), default="USD")
    base_price_cents: Mapped[int | None] = mapped_column(Integer)
    min_price_cents: Mapped[int | None] = mapped_column(Integer)
    max_price_cents: Mapped[int | None] = mapped_column(Integer)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    metadata_: Mapped[dict] = mapped_column("metadata", JSONB, default=dict)

    organization: Mapped[Organization] = relationship(back_populates="properties")
    comp_sets: Mapped[list[CompSet]] = relationship(back_populates="property")
    competitors: Mapped[list[Competitor]] = relationship(back_populates="property")
    scrape_jobs: Mapped[list[ScrapeJob]] = relationship(back_populates="property")
    observations: Mapped[list[RateObservation]] = relationship(back_populates="property")
    recommendations: Mapped[list[PricingRecommendation]] = relationship(back_populates="property")


class SubscriptionPlan(Base, TimestampMixin):
    __tablename__ = "subscription_plans"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    code: Mapped[str] = mapped_column(Text, unique=True)
    name: Mapped[str] = mapped_column(Text)
    monthly_price_cents: Mapped[int] = mapped_column(Integer)
    stripe_price_id: Mapped[str | None] = mapped_column(Text)
    max_scrapes_per_property_month: Mapped[int] = mapped_column(Integer, default=300)
    max_competitors_per_property: Mapped[int] = mapped_column(Integer, default=25)
    supports_pms_push: Mapped[bool] = mapped_column(Boolean, default=False)
    free_tier: Mapped[bool] = mapped_column(Boolean, default=False)
    max_compute_units_per_month: Mapped[int] = mapped_column(Integer, default=10000)
    max_jobs_per_day: Mapped[int] = mapped_column(Integer, default=200)
    metadata_: Mapped[dict] = mapped_column("metadata", JSONB, default=dict)
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class OrganizationSubscription(Base, TimestampMixin):
    __tablename__ = "organization_subscriptions"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    organization_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), index=True)
    stripe_subscription_id: Mapped[str | None] = mapped_column(Text)
    stripe_customer_id: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(subscription_status_enum, default="incomplete")
    current_period_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    current_period_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cancel_at_period_end: Mapped[bool] = mapped_column(Boolean, default=False)


class PropertySubscription(Base, TimestampMixin):
    __tablename__ = "property_subscriptions"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    organization_subscription_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), index=True)
    property_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), index=True)
    plan_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), index=True)
    stripe_subscription_item_id: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(property_subscription_status_enum, default="active")
    monthly_price_cents: Mapped[int] = mapped_column(Integer)
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class UsageEvent(Base):
    __tablename__ = "usage_events"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    organization_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), index=True)
    property_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), index=True)
    event_type: Mapped[str] = mapped_column(Text)
    compute_units: Mapped[int] = mapped_column(Integer, default=1)
    source: Mapped[str] = mapped_column(Text, default="api")
    idempotency_key: Mapped[str | None] = mapped_column(Text)
    metadata_: Mapped[dict] = mapped_column("metadata", JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class BillingEvent(Base):
    __tablename__ = "billing_events"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    organization_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), index=True)
    stripe_event_id: Mapped[str | None] = mapped_column(Text)
    event_type: Mapped[str] = mapped_column(Text)
    processed: Mapped[bool] = mapped_column(Boolean, default=False)
    payload: Mapped[dict] = mapped_column(JSONB, default=dict)
    error_message: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class CompSet(Base, TimestampMixin):
    __tablename__ = "comp_sets"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    property_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("properties.id", ondelete="CASCADE"),
        index=True,
    )
    name: Mapped[str] = mapped_column(Text, default="Default comp set")
    search_radius_km: Mapped[float | None] = mapped_column(Numeric(6, 2))
    bedrooms_min: Mapped[int | None] = mapped_column(Integer)
    bedrooms_max: Mapped[int | None] = mapped_column(Integer)
    sleeps_min: Mapped[int | None] = mapped_column(Integer)
    sleeps_max: Mapped[int | None] = mapped_column(Integer)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    selection_rules: Mapped[dict] = mapped_column(JSONB, default=dict)

    property: Mapped[Property] = relationship(back_populates="comp_sets")
    competitors: Mapped[list[Competitor]] = relationship(back_populates="comp_set")


class Competitor(Base, TimestampMixin):
    __tablename__ = "competitors"
    __table_args__ = (UniqueConstraint("comp_set_id", "source", "external_url"),)

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    comp_set_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("comp_sets.id", ondelete="CASCADE"),
    )
    property_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("properties.id", ondelete="CASCADE"),
        index=True,
    )
    source: Mapped[ScrapeSource] = mapped_column(scrape_source_enum)
    external_id: Mapped[str | None] = mapped_column(Text)
    external_url: Mapped[str] = mapped_column(Text)
    canonical_url: Mapped[str | None] = mapped_column(Text)
    title: Mapped[str | None] = mapped_column(Text)
    address: Mapped[str | None] = mapped_column(Text)
    latitude: Mapped[float | None] = mapped_column(Numeric(9, 6))
    longitude: Mapped[float | None] = mapped_column(Numeric(9, 6))
    bedrooms: Mapped[int | None] = mapped_column(Integer)
    bathrooms: Mapped[float | None] = mapped_column(Numeric(4, 1))
    sleeps: Mapped[int | None] = mapped_column(Integer)
    rating: Mapped[float | None] = mapped_column(Numeric(3, 2))
    review_count: Mapped[int | None] = mapped_column(Integer)
    similarity_score: Mapped[float | None] = mapped_column(Numeric(5, 4))
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    metadata_: Mapped[dict] = mapped_column("metadata", JSONB, default=dict)

    property: Mapped[Property] = relationship(back_populates="competitors")
    comp_set: Mapped[CompSet] = relationship(back_populates="competitors")
    observations: Mapped[list[RateObservation]] = relationship(back_populates="competitor")


class ScraperStrategy(Base, TimestampMixin):
    __tablename__ = "scraper_strategies"
    __table_args__ = (UniqueConstraint("source", "domain", "layout_fingerprint", "version"),)

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    source: Mapped[ScrapeSource] = mapped_column(scrape_source_enum)
    domain: Mapped[str] = mapped_column(Text)
    layout_fingerprint: Mapped[str] = mapped_column(Text)
    strategy_json: Mapped[dict] = mapped_column(JSONB)
    version: Mapped[int] = mapped_column(Integer, default=1)
    success_rate: Mapped[float] = mapped_column(Numeric(5, 4), default=0)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_by_agent: Mapped[str | None] = mapped_column(Text)


class ScrapeJob(Base, TimestampMixin):
    __tablename__ = "scrape_jobs"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    organization_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), index=True)
    property_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("properties.id", ondelete="CASCADE"),
        index=True,
    )
    competitor_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("competitors.id", ondelete="SET NULL"),
    )
    scraper_strategy_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("scraper_strategies.id", ondelete="SET NULL"),
    )
    source: Mapped[ScrapeSource] = mapped_column(scrape_source_enum)
    target_url: Mapped[str] = mapped_column(Text)
    stay_date_start: Mapped[date | None] = mapped_column(Date)
    stay_date_end: Mapped[date | None] = mapped_column(Date)
    status: Mapped[ScrapeJobStatus] = mapped_column(scrape_job_status_enum, default=ScrapeJobStatus.queued)
    priority: Mapped[int] = mapped_column(Integer, default=100)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    max_attempts: Mapped[int] = mapped_column(Integer, default=3)
    locked_by: Mapped[str | None] = mapped_column(Text)
    locked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    error_code: Mapped[str | None] = mapped_column(Text)
    error_message: Mapped[str | None] = mapped_column(Text)
    request_context: Mapped[dict] = mapped_column(JSONB, default=dict)
    result_summary: Mapped[dict] = mapped_column(JSONB, default=dict)

    property: Mapped[Property | None] = relationship(back_populates="scrape_jobs")
    logs: Mapped[list[ScrapeJobLog]] = relationship(back_populates="scrape_job")


class ScrapeJobLog(Base):
    __tablename__ = "scrape_job_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    scrape_job_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("scrape_jobs.id", ondelete="CASCADE"),
        index=True,
    )
    level: Mapped[str] = mapped_column(Text)
    event: Mapped[str] = mapped_column(Text)
    message: Mapped[str | None] = mapped_column(Text)
    payload: Mapped[dict] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    scrape_job: Mapped[ScrapeJob] = relationship(back_populates="logs")


class ScrapeSnapshot(Base):
    __tablename__ = "scrape_snapshots"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    scrape_job_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), index=True)
    competitor_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True))
    source: Mapped[ScrapeSource] = mapped_column(scrape_source_enum)
    raw_html_url: Mapped[str | None] = mapped_column(Text)
    screenshot_url: Mapped[str | None] = mapped_column(Text)
    network_trace_url: Mapped[str | None] = mapped_column(Text)
    dom_fingerprint: Mapped[str | None] = mapped_column(Text)
    layout_fingerprint: Mapped[str | None] = mapped_column(Text)
    extraction_confidence: Mapped[float | None] = mapped_column(Numeric(5, 4))
    metadata_: Mapped[dict] = mapped_column("metadata", JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class RateObservation(Base):
    __tablename__ = "rate_observations"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    property_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("properties.id", ondelete="CASCADE"),
        index=True,
    )
    competitor_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("competitors.id", ondelete="SET NULL"),
        index=True,
    )
    scrape_job_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True))
    scrape_snapshot_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True))
    source: Mapped[ScrapeSource] = mapped_column(scrape_source_enum)
    stay_date: Mapped[date] = mapped_column(Date, index=True)
    currency_code: Mapped[str] = mapped_column(String(3), default="USD")
    nightly_rate_cents: Mapped[int | None] = mapped_column(Integer)
    total_rate_cents: Mapped[int | None] = mapped_column(Integer)
    fees_cents: Mapped[int | None] = mapped_column(Integer)
    taxes_cents: Mapped[int | None] = mapped_column(Integer)
    available: Mapped[bool | None] = mapped_column(Boolean)
    min_nights: Mapped[int | None] = mapped_column(Integer)
    max_nights: Mapped[int | None] = mapped_column(Integer)
    cancellation_policy: Mapped[str | None] = mapped_column(Text)
    extraction_confidence: Mapped[float | None] = mapped_column(Numeric(5, 4))
    observed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    raw_payload: Mapped[dict] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    property: Mapped[Property] = relationship(back_populates="observations")
    competitor: Mapped[Competitor | None] = relationship(back_populates="observations")


class PricingRecommendation(Base, TimestampMixin):
    __tablename__ = "pricing_recommendations"
    __table_args__ = (
        CheckConstraint("recommended_rate_cents >= 0"),
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    property_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("properties.id", ondelete="CASCADE"),
        index=True,
    )
    stay_date: Mapped[date] = mapped_column(Date, index=True)
    currency_code: Mapped[str] = mapped_column(String(3), default="USD")
    current_rate_cents: Mapped[int | None] = mapped_column(Integer)
    recommended_rate_cents: Mapped[int] = mapped_column(Integer)
    min_rate_cents: Mapped[int | None] = mapped_column(Integer)
    max_rate_cents: Mapped[int | None] = mapped_column(Integer)
    confidence: Mapped[float | None] = mapped_column(Numeric(5, 4))
    recommended_min_stay: Mapped[int | None] = mapped_column(Integer)
    discount_percent: Mapped[float | None] = mapped_column(Numeric(5, 2))
    status: Mapped[PricingRecommendationStatus] = mapped_column(
        recommendation_status_enum,
        default=PricingRecommendationStatus.draft,
    )
    model_version: Mapped[str] = mapped_column(Text)
    comp_set_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True))
    reason: Mapped[dict] = mapped_column(JSONB, default=dict)
    approved_by_user_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True))
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    superseded_by_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True))

    property: Mapped[Property] = relationship(back_populates="recommendations")


class LocalEvent(Base, TimestampMixin):
    __tablename__ = "local_events"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    organization_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), index=True)
    property_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), index=True)
    name: Mapped[str] = mapped_column(Text)
    category: Mapped[str | None] = mapped_column(Text)
    starts_on: Mapped[date] = mapped_column(Date, index=True)
    ends_on: Mapped[date] = mapped_column(Date, index=True)
    distance_km: Mapped[float | None] = mapped_column(Numeric(6, 2))
    demand_score: Mapped[float] = mapped_column(Numeric(5, 4), default=0.5)
    source: Mapped[str] = mapped_column(Text, default="manual")
    metadata_: Mapped[dict] = mapped_column("metadata", JSONB, default=dict)


class OccupancySignal(Base):
    __tablename__ = "occupancy_signals"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    property_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), index=True)
    stay_date: Mapped[date] = mapped_column(Date, index=True)
    property_occupancy: Mapped[float | None] = mapped_column(Numeric(5, 4))
    market_occupancy: Mapped[float | None] = mapped_column(Numeric(5, 4))
    pacing_ratio: Mapped[float | None] = mapped_column(Numeric(7, 4))
    pickup_7d: Mapped[int | None] = mapped_column(Integer)
    pickup_30d: Mapped[int | None] = mapped_column(Integer)
    source: Mapped[str] = mapped_column(Text, default="pms")
    metadata_: Mapped[dict] = mapped_column("metadata", JSONB, default=dict)
    observed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class PricingExperiment(Base, TimestampMixin):
    __tablename__ = "pricing_experiments"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    organization_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), index=True)
    property_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), index=True)
    name: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(Text, default="draft")
    hypothesis: Mapped[str | None] = mapped_column(Text)
    variants: Mapped[dict] = mapped_column(JSONB)
    traffic_split: Mapped[dict] = mapped_column(JSONB, default=dict)
    primary_metric: Mapped[str] = mapped_column(Text, default="revpar")
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class PricingExperimentAssignment(Base):
    __tablename__ = "pricing_experiment_assignments"
    __table_args__ = (UniqueConstraint("experiment_id", "property_id", "stay_date"),)

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    experiment_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), index=True)
    property_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), index=True)
    pricing_recommendation_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True))
    stay_date: Mapped[date] = mapped_column(Date, index=True)
    variant_key: Mapped[str] = mapped_column(Text)
    assigned_rate_cents: Mapped[int] = mapped_column(Integer)
    assigned_min_stay: Mapped[int | None] = mapped_column(Integer)
    assigned_discount_percent: Mapped[float | None] = mapped_column(Numeric(5, 2))
    assignment_context: Mapped[dict] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class PricingPerformanceEvent(Base):
    __tablename__ = "pricing_performance_events"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    property_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), index=True)
    pricing_recommendation_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), index=True)
    experiment_assignment_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), index=True)
    stay_date: Mapped[date] = mapped_column(Date, index=True)
    booked: Mapped[bool] = mapped_column(Boolean, default=False)
    booked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    realized_rate_cents: Mapped[int | None] = mapped_column(Integer)
    revenue_cents: Mapped[int | None] = mapped_column(Integer)
    occupancy_status: Mapped[str] = mapped_column(Text, default="unknown")
    channel: Mapped[str | None] = mapped_column(Text)
    metadata_: Mapped[dict] = mapped_column("metadata", JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class PmsConnection(Base, TimestampMixin):
    __tablename__ = "pms_connections"
    __table_args__ = (UniqueConstraint("organization_id", "provider", "account_ref"),)

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    organization_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), index=True)
    provider: Mapped[PmsProvider] = mapped_column(pms_provider_enum)
    account_ref: Mapped[str | None] = mapped_column(Text)
    display_name: Mapped[str | None] = mapped_column(Text)
    status: Mapped[PmsConnectionStatus] = mapped_column(
        pms_status_enum,
        default=PmsConnectionStatus.connected,
    )
    access_token_encrypted: Mapped[str | None] = mapped_column(Text)
    refresh_token_encrypted: Mapped[str | None] = mapped_column(Text)
    credentials_encrypted: Mapped[dict | None] = mapped_column(JSONB)
    webhook_secret_encrypted: Mapped[str | None] = mapped_column(Text)
    credential_fingerprint: Mapped[str | None] = mapped_column(Text)
    credentials_version: Mapped[int] = mapped_column(Integer, default=1)
    token_cipher: Mapped[str] = mapped_column(Text, default="kms:aes-256-gcm")
    token_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    scopes: Mapped[list[str]] = mapped_column(ARRAY(Text), default=list)
    last_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_sync_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    error_message: Mapped[str | None] = mapped_column(Text)
    metadata_: Mapped[dict] = mapped_column("metadata", JSONB, default=dict)


class OtaDirectCredential(Base):
    __tablename__ = "ota_direct_credentials"
    __table_args__ = (UniqueConstraint("user_id", "property_id", "platform"),)

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), index=True)
    property_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("properties.id", ondelete="CASCADE"),
        index=True,
    )
    platform: Mapped[OtaDirectPlatform] = mapped_column(ota_direct_platform_enum)
    encrypted_credentials: Mapped[bytes] = mapped_column(LargeBinary)
    encryption_salt: Mapped[str] = mapped_column(Text)
    last_successful_login: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_push: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[OtaDirectStatus] = mapped_column(
        ota_direct_status_enum,
        default=OtaDirectStatus.pending,
    )
    consent_accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    consent_ip: Mapped[str | None] = mapped_column(Text)
    failure_count: Mapped[int] = mapped_column(Integer, default=0)
    two_fa_attempts: Mapped[int] = mapped_column(Integer, default=0)
    last_error: Mapped[str | None] = mapped_column(Text)
    metadata_: Mapped[dict] = mapped_column("metadata", JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )


class PropertyPmsMapping(Base, TimestampMixin):
    __tablename__ = "property_pms_mappings"
    __table_args__ = (
        UniqueConstraint("property_id", "pms_connection_id"),
        UniqueConstraint("pms_connection_id", "external_property_id"),
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    property_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), index=True)
    pms_connection_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), index=True)
    external_property_id: Mapped[str] = mapped_column(Text)
    external_channel_ids: Mapped[dict] = mapped_column(JSONB, default=dict)
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class PmsSyncRun(Base):
    __tablename__ = "pms_sync_runs"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    organization_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), index=True)
    pms_connection_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), index=True)
    property_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), index=True)
    direction: Mapped[str] = mapped_column(Text)
    provider: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(Text, default="queued")
    fallback_used: Mapped[bool] = mapped_column(Boolean, default=False)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    pulled_count: Mapped[int] = mapped_column(Integer, default=0)
    pushed_count: Mapped[int] = mapped_column(Integer, default=0)
    skipped_count: Mapped[int] = mapped_column(Integer, default=0)
    error_message: Mapped[str | None] = mapped_column(Text)
    request_summary: Mapped[dict] = mapped_column(JSONB, default=dict)
    response_summary: Mapped[dict] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class RatePush(Base, TimestampMixin):
    __tablename__ = "rate_pushes"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    property_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), index=True)
    pms_connection_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), index=True)
    pricing_recommendation_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True))
    stay_date: Mapped[date] = mapped_column(Date, index=True)
    currency_code: Mapped[str] = mapped_column(String(3), default="USD")
    rate_cents: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(Text)
    external_request_id: Mapped[str | None] = mapped_column(Text)
    external_response: Mapped[dict] = mapped_column(JSONB, default=dict)
    error_message: Mapped[str | None] = mapped_column(Text)
    pushed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class AgentTrainingRun(Base):
    __tablename__ = "agent_training_runs"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    scrape_job_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), index=True)
    scraper_strategy_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), index=True)
    source: Mapped[ScrapeSource] = mapped_column(scrape_source_enum)
    domain: Mapped[str] = mapped_column(Text)
    layout_fingerprint: Mapped[str | None] = mapped_column(Text)
    agent_name: Mapped[str] = mapped_column(Text)
    model_name: Mapped[str | None] = mapped_column(Text)
    prompt_version: Mapped[str | None] = mapped_column(Text)
    status: Mapped[AgentTrainingStatus] = mapped_column(
        agent_training_status_enum,
        default=AgentTrainingStatus.candidate,
    )
    input_snapshot_url: Mapped[str | None] = mapped_column(Text)
    input_dom_url: Mapped[str | None] = mapped_column(Text)
    generated_strategy_json: Mapped[dict | None] = mapped_column(JSONB)
    validation_report: Mapped[dict] = mapped_column(JSONB, default=dict)
    confidence: Mapped[float | None] = mapped_column(Numeric(5, 4))
    token_usage: Mapped[dict] = mapped_column(JSONB, default=dict)
    error_message: Mapped[str | None] = mapped_column(Text)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
