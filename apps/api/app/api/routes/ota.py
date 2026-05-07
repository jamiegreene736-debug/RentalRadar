from __future__ import annotations

import asyncio
import json
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, WebSocket, WebSocketDisconnect
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import OtaDirectCredential, OtaDirectStatus
from app.db.session import get_db
from app.deps import RequestContext, get_request_context
from app.schemas import (
    OtaDirectConnectRequest,
    OtaDirectConnectResponse,
    OtaDirectCredentialResponse,
    OtaDirectPushRequest,
    OtaDirectPushResponse,
    OtaDirectStatusResponse,
    OtaDirectTwoFactorRequest,
)
from app.services.cache import get_redis
from app.services.direct_ota import HIGH_RISK_NOTICE, DirectOTAPusher, property_for_user

router = APIRouter(tags=["ota-direct"])


@router.post("/ota/connect-direct", response_model=OtaDirectConnectResponse, status_code=201)
def connect_direct_ota(
    payload: OtaDirectConnectRequest,
    request: Request,
    db: Session = Depends(get_db),
    context: RequestContext = Depends(get_request_context),
) -> OtaDirectConnectResponse:
    if context.user_id is None:
        raise HTTPException(status_code=401, detail="Direct OTA mode requires a user-scoped auth token.")
    try:
        property_for_user(db, payload.property_id, context.organization_id)
        credential = DirectOTAPusher().store_credentials(
            db,
            user_id=context.user_id,
            property_id=payload.property_id,
            platform=payload.platform,
            email=payload.email,
            password=payload.password,
            consent_accepted=payload.consent_accepted,
            consent_ip=request.client.host if request.client else None,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    task_id: str | None = None
    if payload.dry_run:
        result = DirectOTAPusher().push_rates(
            property_id=payload.property_id,
            user_id=context.user_id,
            rate_calendar=[],
            platform=payload.platform,
            dry_run=True,
        )
        task_id = result["task_id"]

    return OtaDirectConnectResponse(
        credential=_serialize_credential(credential),
        task_id=task_id,
        high_risk_notice=HIGH_RISK_NOTICE,
    )


@router.post("/ota/2fa-submit", status_code=202)
def submit_ota_2fa(
    payload: OtaDirectTwoFactorRequest,
    db: Session = Depends(get_db),
    context: RequestContext = Depends(get_request_context),
) -> dict[str, str]:
    if context.user_id is None:
        raise HTTPException(status_code=401, detail="Direct OTA mode requires a user-scoped auth token.")
    try:
        property_for_user(db, payload.property_id, context.organization_id)
        DirectOTAPusher().handle_2fa(payload.property_id, payload.code, context.user_id, payload.platform)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"status": "submitted", "message": "2FA code sent to the active headed Chrome session."}


@router.post("/pricing/push-direct", response_model=OtaDirectPushResponse, status_code=202)
def push_direct_pricing(
    payload: OtaDirectPushRequest,
    db: Session = Depends(get_db),
    context: RequestContext = Depends(get_request_context),
) -> OtaDirectPushResponse:
    if context.user_id is None:
        raise HTTPException(status_code=401, detail="Direct OTA mode requires a user-scoped auth token.")
    if not payload.consent_accepted:
        raise HTTPException(status_code=400, detail=HIGH_RISK_NOTICE)
    try:
        property_for_user(db, payload.property_id, context.organization_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    result = DirectOTAPusher().push_rates(
        property_id=payload.property_id,
        user_id=context.user_id,
        rate_calendar=payload.rates,
        platform=payload.platform,
        dry_run=payload.dry_run,
    )
    return OtaDirectPushResponse(**result)


@router.get("/ota/status", response_model=OtaDirectStatusResponse)
def ota_direct_status(
    property_id: UUID | None = None,
    db: Session = Depends(get_db),
    context: RequestContext = Depends(get_request_context),
) -> OtaDirectStatusResponse:
    if context.user_id is None:
        raise HTTPException(status_code=401, detail="Direct OTA mode requires a user-scoped auth token.")
    query = select(OtaDirectCredential).where(OtaDirectCredential.user_id == context.user_id)
    if property_id:
        query = query.where(OtaDirectCredential.property_id == property_id)
    credentials = db.scalars(query.order_by(OtaDirectCredential.created_at.desc())).all()
    return OtaDirectStatusResponse(
        credentials=[_serialize_credential(row) for row in credentials],
        high_risk_notice=HIGH_RISK_NOTICE,
    )


@router.delete("/ota/direct/{credential_id}", status_code=204)
def revoke_direct_ota(
    credential_id: UUID,
    db: Session = Depends(get_db),
    context: RequestContext = Depends(get_request_context),
) -> None:
    if context.user_id is None:
        raise HTTPException(status_code=401, detail="Direct OTA mode requires a user-scoped auth token.")
    DirectOTAPusher().revoke(db, credential_id=credential_id, user_id=context.user_id)


@router.websocket("/ota/ws")
async def ota_notifications_ws(websocket: WebSocket) -> None:
    """Dashboard notification stream.

    Clerk/Supabase JWT auth should replace the query-string demo user in production.
    """

    user_id = websocket.query_params.get("user_id")
    if not user_id:
        await websocket.close(code=4401)
        return
    await websocket.accept()
    redis = get_redis()
    pubsub = redis.pubsub()
    pubsub.subscribe(f"rentalradar:user:{user_id}:events")
    try:
        while True:
            message = pubsub.get_message(ignore_subscribe_messages=True, timeout=1)
            if message and message.get("data"):
                data = message["data"]
                await websocket.send_text(data if isinstance(data, str) else json.dumps(data))
            await asyncio.sleep(0.5)
    except WebSocketDisconnect:
        pass
    finally:
        pubsub.close()


def _serialize_credential(credential: OtaDirectCredential) -> OtaDirectCredentialResponse:
    return OtaDirectCredentialResponse(
        id=credential.id,
        property_id=credential.property_id,
        platform=credential.platform,
        status=credential.status if isinstance(credential.status, OtaDirectStatus) else OtaDirectStatus(credential.status),
        last_successful_login=credential.last_successful_login,
        last_push=credential.last_push,
        failure_count=credential.failure_count,
        two_fa_attempts=credential.two_fa_attempts,
        last_error=credential.last_error,
        high_risk_notice=HIGH_RISK_NOTICE,
    )
