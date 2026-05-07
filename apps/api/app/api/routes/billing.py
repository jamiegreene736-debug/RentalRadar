from __future__ import annotations

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.deps import RequestContext, get_request_context
from app.schemas import BillingCheckoutRequest, BillingPortalRequest, BillingSessionResponse, UsageSummaryResponse
from app.services.billing import BillingConfigError, StripeBillingService
from app.services.usage import usage_summary

router = APIRouter(tags=["billing"])


@router.post("/billing/checkout", response_model=BillingSessionResponse)
def create_checkout(
    payload: BillingCheckoutRequest,
    db: Session = Depends(get_db),
    context: RequestContext = Depends(get_request_context),
) -> BillingSessionResponse:
    try:
        result = StripeBillingService().create_checkout_session(
            db,
            context.organization_id,
            payload.plan_code,
            payload.property_quantity,
        )
        return BillingSessionResponse(**result)
    except (BillingConfigError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/billing/portal", response_model=BillingSessionResponse)
def create_portal(
    payload: BillingPortalRequest,
    db: Session = Depends(get_db),
    context: RequestContext = Depends(get_request_context),
) -> BillingSessionResponse:
    try:
        return BillingSessionResponse(
            **StripeBillingService().create_portal_session(db, context.organization_id, payload.return_url)
        )
    except (BillingConfigError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/billing/usage", response_model=UsageSummaryResponse)
def current_usage(
    db: Session = Depends(get_db),
    context: RequestContext = Depends(get_request_context),
) -> UsageSummaryResponse:
    return UsageSummaryResponse(**usage_summary(db, context.organization_id))


@router.post("/webhooks/stripe")
async def stripe_webhook(
    request: Request,
    stripe_signature: str | None = Header(default=None, alias="Stripe-Signature"),
    db: Session = Depends(get_db),
) -> dict:
    payload = await request.body()
    try:
        return StripeBillingService().handle_webhook(db, payload, stripe_signature)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
