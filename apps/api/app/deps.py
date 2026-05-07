from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from fastapi import Depends, Header, HTTPException, status

from app.db.session import get_db


@dataclass(frozen=True)
class RequestContext:
    organization_id: UUID
    user_id: UUID | None = None


def get_request_context(
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
    return RequestContext(organization_id=org_id, user_id=user_id)


DbSession = Depends(get_db)
AuthContext = Depends(get_request_context)
