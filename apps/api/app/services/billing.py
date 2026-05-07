from __future__ import annotations

import json
from datetime import datetime, timezone
from uuid import UUID

import stripe
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db.models import (
    BillingEvent,
    Organization,
    OrganizationSubscription,
    Property,
    PropertySubscription,
    SubscriptionPlan,
)


class BillingConfigError(RuntimeError):
    pass


class StripeBillingService:
    def __init__(self) -> None:
        self.settings = get_settings()
        if self.settings.stripe_secret_key:
            stripe.api_key = self.settings.stripe_secret_key

    def create_checkout_session(
        self,
        db: Session,
        organization_id: UUID,
        plan_code: str,
        property_quantity: int,
    ) -> dict:
        plan = self._plan(db, plan_code)
        if plan.free_tier or plan.monthly_price_cents == 0:
            self.activate_free_plan(db, organization_id)
            return {"url": f"{self.settings.app_base_url}?billing=free", "mode": "free"}

        if not self.settings.stripe_secret_key:
            raise BillingConfigError("STRIPE_SECRET_KEY is not configured")
        if not plan.stripe_price_id:
            plan.stripe_price_id = self._stripe_price_for_plan(plan.code)
        if not plan.stripe_price_id:
            raise BillingConfigError(f"Stripe price ID is not configured for {plan.code}")

        organization = db.get(Organization, organization_id)
        if organization is None:
            raise ValueError("Organization not found")
        if not organization.stripe_customer_id:
            customer = stripe.Customer.create(
                name=organization.name,
                email=organization.billing_email,
                metadata={"organization_id": str(organization_id)},
            )
            organization.stripe_customer_id = customer["id"]
            db.commit()

        session = stripe.checkout.Session.create(
            mode="subscription",
            customer=organization.stripe_customer_id,
            line_items=[{"price": plan.stripe_price_id, "quantity": max(1, property_quantity)}],
            success_url=f"{self.settings.app_base_url}?billing=success&session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{self.settings.app_base_url}?billing=cancelled",
            metadata={"organization_id": str(organization_id), "plan_code": plan.code},
            subscription_data={
                "metadata": {"organization_id": str(organization_id), "plan_code": plan.code}
            },
        )
        return {"url": session["url"], "mode": "checkout", "session_id": session["id"]}

    def create_portal_session(self, db: Session, organization_id: UUID, return_url: str | None = None) -> dict:
        if not self.settings.stripe_secret_key:
            raise BillingConfigError("STRIPE_SECRET_KEY is not configured")
        organization = db.get(Organization, organization_id)
        if organization is None or not organization.stripe_customer_id:
            raise ValueError("No Stripe customer found for organization")
        session = stripe.billing_portal.Session.create(
            customer=organization.stripe_customer_id,
            return_url=return_url or self.settings.app_base_url,
        )
        return {"url": session["url"]}

    def handle_webhook(self, db: Session, payload: bytes, signature: str | None) -> dict:
        if not self.settings.stripe_webhook_secret:
            raise BillingConfigError("STRIPE_WEBHOOK_SECRET is not configured")
        raw_event = json.loads(payload.decode("utf-8"))
        event = stripe.Webhook.construct_event(
            payload=payload,
            sig_header=signature,
            secret=self.settings.stripe_webhook_secret,
        )
        event_type = event["type"]
        data = event["data"]["object"]
        organization_id = _uuid_or_none(data.get("metadata", {}).get("organization_id"))

        existing_event = db.scalar(select(BillingEvent).where(BillingEvent.stripe_event_id == event["id"]))
        if existing_event and existing_event.processed:
            return {"received": True, "event_type": event_type, "duplicate": True}

        billing_event = existing_event or BillingEvent(
            organization_id=organization_id,
            stripe_event_id=event["id"],
            event_type=event_type,
            payload=raw_event,
        )
        db.add(billing_event)
        try:
            if event_type == "checkout.session.completed":
                subscription = self._subscription_from_checkout(data)
                self._upsert_subscription(db, subscription or data)
            elif event_type in {"customer.subscription.created", "customer.subscription.updated"}:
                self._upsert_subscription(db, data)
            elif event_type == "customer.subscription.deleted":
                self._cancel_subscription(db, data)
            billing_event.processed = True
            db.commit()
        except Exception as exc:
            billing_event.error_message = str(exc)
            db.commit()
            raise
        return {"received": True, "event_type": event_type}

    def activate_free_plan(self, db: Session, organization_id: UUID) -> None:
        free_plan = self._plan(db, "free_1")
        properties = db.scalars(
            select(Property)
            .where(Property.organization_id == organization_id)
            .where(Property.active.is_(True))
            .order_by(Property.created_at.asc())
            .limit(get_settings().free_tier_property_limit)
        ).all()
        for rental in properties:
            existing = db.scalar(
                select(PropertySubscription)
                .where(PropertySubscription.property_id == rental.id)
                .where(PropertySubscription.status.in_(["active", "past_due"]))
            )
            if existing is None:
                db.add(
                    PropertySubscription(
                        property_id=rental.id,
                        plan_id=free_plan.id,
                        status="active",
                        monthly_price_cents=0,
                    )
                )
        db.commit()

    def _upsert_subscription(self, db: Session, data: dict) -> None:
        metadata = data.get("metadata", {})
        organization_id = _uuid_or_none(metadata.get("organization_id"))
        if organization_id is None and data.get("customer"):
            organization = db.scalar(
                select(Organization).where(Organization.stripe_customer_id == data["customer"])
            )
            organization_id = organization.id if organization else None
        if organization_id is None:
            return
        subscription_id = data.get("subscription") or data.get("id")
        status = data.get("status", "active")
        org_sub = db.scalar(
            select(OrganizationSubscription)
            .where(OrganizationSubscription.stripe_subscription_id == subscription_id)
        )
        if org_sub is None:
            org_sub = OrganizationSubscription(
                organization_id=organization_id,
                stripe_subscription_id=subscription_id,
            )
            db.add(org_sub)
        org_sub.status = status
        org_sub.stripe_customer_id = data.get("customer")
        org_sub.current_period_start = _dt(data.get("current_period_start"))
        org_sub.current_period_end = _dt(data.get("current_period_end"))
        org_sub.cancel_at_period_end = bool(data.get("cancel_at_period_end", False))
        db.flush()
        self._sync_property_subscriptions(db, org_sub, data, metadata)

    def _cancel_subscription(self, db: Session, data: dict) -> None:
        subscription_id = data.get("id")
        org_sub = db.scalar(
            select(OrganizationSubscription)
            .where(OrganizationSubscription.stripe_subscription_id == subscription_id)
        )
        if org_sub:
            org_sub.status = "canceled"
            property_subs = db.scalars(
                select(PropertySubscription).where(PropertySubscription.organization_subscription_id == org_sub.id)
            ).all()
            for property_sub in property_subs:
                property_sub.status = "canceled"
                property_sub.ends_at = datetime.now(timezone.utc)

    def _plan(self, db: Session, plan_code: str) -> SubscriptionPlan:
        plan = db.scalar(select(SubscriptionPlan).where(SubscriptionPlan.code == plan_code))
        if plan is None:
            raise ValueError(f"Subscription plan not found: {plan_code}")
        return plan

    def _stripe_price_for_plan(self, plan_code: str) -> str | None:
        return {
            "starter_3": self.settings.stripe_price_starter,
            "growth_6": self.settings.stripe_price_growth,
            "pro_9": self.settings.stripe_price_pro,
        }.get(plan_code)

    def _subscription_from_checkout(self, data: dict) -> dict | None:
        subscription_id = data.get("subscription")
        if not subscription_id:
            return None
        subscription = stripe.Subscription.retrieve(subscription_id)
        if hasattr(subscription, "to_dict_recursive"):
            subscription = subscription.to_dict_recursive()
        if data.get("metadata"):
            subscription.setdefault("metadata", {}).update(data["metadata"])
        return subscription

    def _sync_property_subscriptions(
        self,
        db: Session,
        org_sub: OrganizationSubscription,
        data: dict,
        metadata: dict,
    ) -> None:
        plan_code = metadata.get("plan_code")
        if not plan_code:
            return
        plan = self._plan(db, plan_code)
        quantity = _subscription_quantity(data)
        properties = db.scalars(
            select(Property)
            .where(Property.organization_id == org_sub.organization_id)
            .where(Property.active.is_(True))
            .order_by(Property.created_at.asc())
            .limit(quantity)
        ).all()
        item_id = _first_subscription_item_id(data)
        for rental in properties:
            property_sub = db.scalar(
                select(PropertySubscription)
                .where(PropertySubscription.property_id == rental.id)
                .where(PropertySubscription.status.in_(["active", "past_due"]))
            )
            if property_sub is None:
                property_sub = PropertySubscription(
                    property_id=rental.id,
                    plan_id=plan.id,
                    monthly_price_cents=plan.monthly_price_cents,
                )
                db.add(property_sub)
            property_sub.organization_subscription_id = org_sub.id
            property_sub.plan_id = plan.id
            property_sub.status = _property_subscription_status(org_sub.status)
            property_sub.monthly_price_cents = plan.monthly_price_cents
            property_sub.stripe_subscription_item_id = item_id


def _uuid_or_none(value: str | None) -> UUID | None:
    if not value:
        return None
    try:
        return UUID(value)
    except ValueError:
        return None


def _dt(value: int | None) -> datetime | None:
    if value is None:
        return None
    return datetime.fromtimestamp(value, tz=timezone.utc)


def _subscription_quantity(data: dict) -> int:
    items = data.get("items", {}).get("data", [])
    if not items:
        return 1
    return max(1, int(items[0].get("quantity") or 1))


def _first_subscription_item_id(data: dict) -> str | None:
    items = data.get("items", {}).get("data", [])
    if not items:
        return None
    return items[0].get("id")


def _property_subscription_status(subscription_status: str) -> str:
    if subscription_status in {"active", "past_due"}:
        return subscription_status
    if subscription_status == "trialing":
        return "active"
    return "paused"
