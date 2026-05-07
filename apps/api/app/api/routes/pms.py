from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.models import PmsConnection, PmsConnectionStatus
from app.db.session import get_db
from app.deps import RequestContext, get_request_context
from app.schemas import PmsConnectRequest, PmsConnectResponse
from app.services.crypto import TokenCipher
from app.services.pms import PmsConnectorRegistry

router = APIRouter(tags=["pms"])


@router.post("/pms/connect", response_model=PmsConnectResponse, status_code=201)
def connect_pms(
    payload: PmsConnectRequest,
    db: Session = Depends(get_db),
    context: RequestContext = Depends(get_request_context),
) -> PmsConnectResponse:
    registry = PmsConnectorRegistry()

    access_token = payload.access_token or payload.api_key
    refresh_token = payload.refresh_token
    account_ref = payload.account_ref

    if payload.oauth_code:
        access_token, refresh_token, account_ref = registry.exchange_oauth_code(
            provider=payload.provider.value,
            oauth_code=payload.oauth_code,
            redirect_uri=payload.redirect_uri,
        )

    if not access_token:
        raise HTTPException(
            status_code=400,
            detail="Provide api_key, access_token, or oauth_code for PMS connection",
        )

    cipher = TokenCipher()
    connection = PmsConnection(
        organization_id=context.organization_id,
        provider=payload.provider,
        account_ref=account_ref,
        display_name=payload.display_name,
        status=PmsConnectionStatus.connected,
        access_token_encrypted=cipher.encrypt(access_token),
        refresh_token_encrypted=cipher.encrypt(refresh_token),
        token_cipher="fernet:sha256-env-key",
        scopes=payload.scopes,
        last_verified_at=datetime.now(timezone.utc),
        metadata_=payload.metadata,
    )
    db.add(connection)
    db.commit()
    db.refresh(connection)

    return PmsConnectResponse(
        id=connection.id,
        provider=connection.provider,
        account_ref=connection.account_ref,
        status=connection.status.value,
    )
