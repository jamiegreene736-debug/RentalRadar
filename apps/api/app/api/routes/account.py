from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import AppUser
from app.db.session import get_db
from app.deps import RequestContext, get_request_context
from app.schemas import AccountProfileResponse, AccountProfileUpdate

router = APIRouter(prefix="/account", tags=["account"])


@router.get("/profile", response_model=AccountProfileResponse)
def get_account_profile(
    db: Session = Depends(get_db),
    context: RequestContext = Depends(get_request_context),
) -> AccountProfileResponse:
    user = _find_user(db, context, None)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account profile not found")
    return _response(user)


@router.patch("/profile", response_model=AccountProfileResponse)
def update_account_profile(
    payload: AccountProfileUpdate,
    db: Session = Depends(get_db),
    context: RequestContext = Depends(get_request_context),
) -> AccountProfileResponse:
    if context.user_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing X-User-Id")

    user = _find_user(db, context, payload)
    if user is None:
        email = _clean(payload.email)
        if email is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email is required to create an account profile")
        user = AppUser(
            id=context.user_id,
            email=email,
            clerk_user_id=_clean(payload.clerk_user_id),
            default_organization_id=context.organization_id,
        )
        db.add(user)

    user.email = _clean(payload.email) or user.email
    user.first_name = _clean(payload.first_name)
    user.last_name = _clean(payload.last_name)
    user.full_name = _full_name(user.first_name, user.last_name)
    user.phone_number = _clean(payload.phone_number)
    user.company_name = _clean(payload.company_name)
    user.job_title = _clean(payload.job_title)
    user.timezone = _clean(payload.timezone) or "America/New_York"
    user.locale = _clean(payload.locale) or "en-US"
    user.notification_email = _clean(payload.notification_email) or user.email
    user.marketing_opt_in = payload.marketing_opt_in
    user.avatar_url = _clean(payload.avatar_url) or user.avatar_url
    user.clerk_user_id = _clean(payload.clerk_user_id) or user.clerk_user_id
    user.default_organization_id = user.default_organization_id or context.organization_id
    user.profile_completed_at = _completed_at(user)

    db.commit()
    db.refresh(user)
    return _response(user)


def _find_user(db: Session, context: RequestContext, payload: AccountProfileUpdate | None) -> AppUser | None:
    if context.user_id is not None:
        user = db.get(AppUser, context.user_id)
        if user is not None:
            return user

    clerk_user_id = _clean(payload.clerk_user_id) if payload else None
    if clerk_user_id:
        user = db.scalar(select(AppUser).where(AppUser.clerk_user_id == clerk_user_id))
        if user is not None:
            return user

    email = _clean(payload.email) if payload else None
    if email:
        return db.scalar(select(AppUser).where(AppUser.email == email))

    return None


def _response(user: AppUser) -> AccountProfileResponse:
    return AccountProfileResponse(
        id=user.id,
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        full_name=user.full_name,
        avatar_url=user.avatar_url,
        phone_number=user.phone_number,
        company_name=user.company_name,
        job_title=user.job_title,
        timezone=user.timezone,
        locale=user.locale,
        notification_email=user.notification_email,
        marketing_opt_in=user.marketing_opt_in,
        profile_completed_at=user.profile_completed_at,
        clerk_user_id=user.clerk_user_id,
        default_organization_id=user.default_organization_id,
        created_at=user.created_at,
        updated_at=user.updated_at,
    )


def _clean(value: str | None) -> str | None:
    if value is None:
        return None
    stripped = value.strip()
    return stripped or None


def _full_name(first_name: str | None, last_name: str | None) -> str | None:
    name = " ".join(part for part in [first_name, last_name] if part)
    return name or None


def _completed_at(user: AppUser) -> datetime | None:
    required = [user.email, user.first_name, user.last_name]
    if all(_clean(value) for value in required):
        return user.profile_completed_at or datetime.now(timezone.utc)
    return None
