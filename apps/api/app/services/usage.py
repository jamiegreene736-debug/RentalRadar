from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db.models import (
    OrganizationSubscription,
    Property,
    PropertySubscription,
    SubscriptionPlan,
    UsageEvent,
)


class UsageLimitExceeded(RuntimeError):
    pass


class BillingRequired(RuntimeError):
    pass


EVENT_UNITS = {
    "api_request": 1,
    "scrape_job": 25,
    "pms_sync": 12,
    "pricing_run": 8,
    "rate_push": 4,
}


def ensure_property_allowed(db: Session, organization_id: UUID) -> None:
    active_count = db.scalar(
        select(func.count(Property.id))
        .where(Property.organization_id == organization_id)
        .where(Property.active.is_(True))
    ) or 0
    plan = current_plan(db, organization_id)
    if plan.free_tier and active_count >= get_settings().free_tier_property_limit:
        raise BillingRequired("Free tier allows 1 active property. Upgrade to add more properties.")


def require_usage_allowance(
    db: Session,
    organization_id: UUID,
    event_type: str,
    property_id: UUID | None = None,
    units: int | None = None,
    source: str = "api",
    idempotency_key: str | None = None,
    record: bool = True,
) -> UsageEvent:
    if idempotency_key:
        existing = db.scalar(
            select(UsageEvent)
            .where(UsageEvent.organization_id == organization_id)
            .where(UsageEvent.idempotency_key == idempotency_key)
        )
        if existing:
            return existing

    plan = current_plan(db, organization_id)
    compute_units = units if units is not None else EVENT_UNITS.get(event_type, 1)
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    used_month = db.scalar(
        select(func.coalesce(func.sum(UsageEvent.compute_units), 0))
        .where(UsageEvent.organization_id == organization_id)
        .where(UsageEvent.created_at >= month_start)
    ) or 0
    jobs_today = db.scalar(
        select(func.count(UsageEvent.id))
        .where(UsageEvent.organization_id == organization_id)
        .where(UsageEvent.event_type != "api_request")
        .where(UsageEvent.created_at >= day_start)
    ) or 0

    if used_month + compute_units > plan.max_compute_units_per_month:
        raise UsageLimitExceeded("Monthly compute guardrail reached. Upgrade or wait for the next billing period.")
    if event_type != "api_request" and jobs_today + 1 > plan.max_jobs_per_day:
        raise UsageLimitExceeded("Daily job guardrail reached. Try again tomorrow or upgrade.")

    if event_type == "scrape_job" and property_id is not None:
        scans = db.scalar(
            select(func.count(UsageEvent.id))
            .where(UsageEvent.organization_id == organization_id)
            .where(UsageEvent.property_id == property_id)
            .where(UsageEvent.event_type == "scrape_job")
            .where(UsageEvent.created_at >= month_start)
        ) or 0
        if scans >= plan.max_scrapes_per_property_month:
            raise UsageLimitExceeded("Monthly scan limit reached for this property.")

    event = UsageEvent(
        organization_id=organization_id,
        property_id=property_id,
        event_type=event_type,
        compute_units=compute_units,
        source=source,
        idempotency_key=idempotency_key,
        metadata_={"plan_code": plan.code},
    )
    if record:
        db.add(event)
        db.flush()
    return event


def current_plan(db: Session, organization_id: UUID) -> SubscriptionPlan:
    active_property_sub = db.scalar(
        select(PropertySubscription)
        .join(Property, Property.id == PropertySubscription.property_id)
        .where(Property.organization_id == organization_id)
        .where(PropertySubscription.status.in_(["active", "past_due"]))
        .order_by(PropertySubscription.created_at.desc())
    )
    if active_property_sub:
        plan = db.get(SubscriptionPlan, active_property_sub.plan_id)
        if plan:
            return plan

    active_org_sub = db.scalar(
        select(OrganizationSubscription)
        .where(OrganizationSubscription.organization_id == organization_id)
        .where(OrganizationSubscription.status.in_(["trialing", "active", "past_due"]))
        .order_by(OrganizationSubscription.created_at.desc())
    )
    if active_org_sub:
        paid_plan = db.scalar(
            select(SubscriptionPlan)
            .where(SubscriptionPlan.active.is_(True))
            .where(SubscriptionPlan.free_tier.is_(False))
            .order_by(SubscriptionPlan.monthly_price_cents.asc())
        )
        if paid_plan:
            return paid_plan

    free_plan = db.scalar(select(SubscriptionPlan).where(SubscriptionPlan.code == "free_1"))
    if free_plan:
        return free_plan
    return SubscriptionPlan(
        code="free_1",
        name="Free",
        monthly_price_cents=0,
        max_scrapes_per_property_month=30,
        max_competitors_per_property=5,
        supports_pms_push=False,
        free_tier=True,
        max_compute_units_per_month=500,
        max_jobs_per_day=20,
        metadata_={"fallback": True},
        active=True,
    )


def usage_summary(db: Session, organization_id: UUID) -> dict:
    plan = current_plan(db, organization_id)
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    compute_month = db.scalar(
        select(func.coalesce(func.sum(UsageEvent.compute_units), 0))
        .where(UsageEvent.organization_id == organization_id)
        .where(UsageEvent.created_at >= month_start)
    ) or 0
    jobs_today = db.scalar(
        select(func.count(UsageEvent.id))
        .where(UsageEvent.organization_id == organization_id)
        .where(UsageEvent.event_type != "api_request")
        .where(UsageEvent.created_at >= day_start)
    ) or 0
    return {
        "plan": {
            "code": plan.code,
            "name": plan.name,
            "free_tier": plan.free_tier,
            "monthly_price_cents": plan.monthly_price_cents,
            "max_compute_units_per_month": plan.max_compute_units_per_month,
            "max_jobs_per_day": plan.max_jobs_per_day,
            "max_scrapes_per_property_month": plan.max_scrapes_per_property_month,
        },
        "usage": {
            "compute_units_month": int(compute_month),
            "jobs_today": int(jobs_today),
            "period_start": month_start.isoformat(),
            "next_reset_estimate": (month_start + timedelta(days=32)).replace(day=1).isoformat(),
        },
    }
