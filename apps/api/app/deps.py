from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.models import AppUser, Organization, OrganizationMember
from app.db.session import get_db


@dataclass(frozen=True)
class RequestContext:
    organization_id: UUID
    user_id: UUID | None = None


def get_request_context(
    db: Session = Depends(get_db),
    x_organization_id: str | None = Header(default=None),
    x_user_id: str | None = Header(default=None),
) -> RequestContext:
    if not x_organization_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing X-Organization-Id. Replace this dependency with Clerk/Supabase JWT auth in production.",
        )
    try:
        org_id = UUID(x_organization_id)
        user_id = UUID(x_user_id) if x_user_id else None
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid auth context UUID header") from exc
    ensure_auth_records(db, org_id, user_id)
    return RequestContext(organization_id=org_id, user_id=user_id)


DbSession = Depends(get_db)
AuthContext = Depends(get_request_context)


def ensure_auth_records(db: Session, organization_id: UUID, user_id: UUID | None) -> None:
    organization = db.get(Organization, organization_id)
    if organization is None:
        organization = Organization(
            id=organization_id,
            name="RentalRadar Workspace",
            slug=f"workspace-{str(organization_id)[:8]}",
        )
        db.add(organization)

    if user_id is not None:
        user = db.get(AppUser, user_id)
        if user is None:
            user = AppUser(
                id=user_id,
                email=f"user-{user_id}@accounts.rentalradar.ai",
                full_name="RentalRadar User",
                default_organization_id=organization_id,
            )
            db.add(user)
        elif user.default_organization_id is None:
            user.default_organization_id = organization_id

        membership = db.scalar(
            select(OrganizationMember)
            .where(OrganizationMember.organization_id == organization_id)
            .where(OrganizationMember.user_id == user_id)
        )
        if membership is None:
            db.add(
                OrganizationMember(
                    organization_id=organization_id,
                    user_id=user_id,
                    role="owner",
                )
            )

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
