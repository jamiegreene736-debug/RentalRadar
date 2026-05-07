from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import PmsConnection, PmsConnectionStatus, Property, PropertyPmsMapping
from app.db.session import get_db
from app.deps import RequestContext, get_request_context
from app.integrations.types import ChannelRateUpdate
from app.schemas import (
    PmsConnectRequest,
    PmsConnectResponse,
    PmsSyncRequest,
    PmsSyncResponse,
    PropertyPmsMappingRequest,
    PropertyPmsMappingResponse,
)
from app.services.credentials import CredentialVault
from app.services.pms import PmsConnectorRegistry
from app.services.usage import UsageLimitExceeded, require_usage_allowance

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
        if not payload.username or not payload.password:
            raise HTTPException(
                status_code=400,
                detail="Provide api_key, access_token, oauth_code, or username/password for PMS connection",
            )

    vault = CredentialVault()
    credentials_encrypted, fingerprint = vault.pack(
        payload.provider,
        {
            "api_key": payload.api_key,
            "access_token": access_token,
            "refresh_token": refresh_token,
            "username": payload.username,
            "password": payload.password,
            "client_id": payload.client_id,
            "client_secret": payload.client_secret,
            "webhook_secret": payload.webhook_secret,
        },
    )

    if not credentials_encrypted:
        raise HTTPException(
            status_code=400,
            detail="No credentials were provided",
        )
    connection = PmsConnection(
        organization_id=context.organization_id,
        provider=payload.provider,
        account_ref=account_ref,
        display_name=payload.display_name,
        status=PmsConnectionStatus.connected,
        access_token_encrypted=None,
        refresh_token_encrypted=None,
        credentials_encrypted=credentials_encrypted,
        webhook_secret_encrypted=None,
        credential_fingerprint=fingerprint,
        credentials_version=1,
        token_cipher="fernet:sha256-env-key",
        scopes=payload.scopes,
        last_verified_at=datetime.now(timezone.utc),
        metadata_=safe_metadata(payload.metadata),
    )
    db.add(connection)
    db.commit()
    db.refresh(connection)

    return PmsConnectResponse(
        id=connection.id,
        provider=connection.provider,
        account_ref=connection.account_ref,
        status=connection.status.value,
        credential_fingerprint=connection.credential_fingerprint,
    )


@router.post("/pms/map-property", response_model=PropertyPmsMappingResponse, status_code=201)
def map_property_to_pms(
    payload: PropertyPmsMappingRequest,
    db: Session = Depends(get_db),
    context: RequestContext = Depends(get_request_context),
) -> PropertyPmsMappingResponse:
    _get_property(db, payload.property_id, context.organization_id)
    connection = _get_connection(db, payload.pms_connection_id, context.organization_id)
    mapping = db.scalar(
        select(PropertyPmsMapping)
        .where(PropertyPmsMapping.property_id == payload.property_id)
        .where(PropertyPmsMapping.pms_connection_id == payload.pms_connection_id)
    )
    if mapping is None:
        mapping = PropertyPmsMapping(
            property_id=payload.property_id,
            pms_connection_id=connection.id,
            external_property_id=payload.external_property_id,
            external_channel_ids=payload.external_channel_ids,
            active=True,
        )
        db.add(mapping)
    else:
        mapping.external_property_id = payload.external_property_id
        mapping.external_channel_ids = payload.external_channel_ids
        mapping.active = True
    db.commit()
    db.refresh(mapping)
    return PropertyPmsMappingResponse(
        id=mapping.id,
        property_id=mapping.property_id,
        pms_connection_id=mapping.pms_connection_id,
        external_property_id=mapping.external_property_id,
        active=mapping.active,
    )


@router.post("/pms/sync", response_model=PmsSyncResponse, status_code=202)
def sync_pms(
    payload: PmsSyncRequest,
    db: Session = Depends(get_db),
    context: RequestContext = Depends(get_request_context),
) -> PmsSyncResponse:
    _get_property(db, payload.property_id, context.organization_id)
    _get_connection(db, payload.pms_connection_id, context.organization_id)
    try:
        require_usage_allowance(
            db,
            context.organization_id,
            "pms_sync",
            property_id=payload.property_id,
            units=12 + len(payload.rates) * 2,
        )
    except UsageLimitExceeded as exc:
        raise HTTPException(status_code=429, detail=str(exc)) from exc
    registry = PmsConnectorRegistry()
    updates = [
        ChannelRateUpdate(
            stay_date=item.stay_date,
            rate_cents=item.rate_cents,
            currency_code="USD",
        )
        for item in payload.rates
    ]
    try:
        if payload.direction == "two_way":
            result = registry.two_way_sync(
                db,
                payload.pms_connection_id,
                payload.property_id,
                payload.start_date,
                payload.end_date,
                updates,
            )
            return PmsSyncResponse(
                status="succeeded",
                pulled_count=result.get("pull", {}).get("pulled_count", 0),
                pushed_count=len(updates),
                fallback_used=bool(result.get("fallback_used")),
                detail=result,
            )
        result = registry.pull_rates(
            db,
            payload.pms_connection_id,
            payload.property_id,
            payload.start_date,
            payload.end_date,
        )
        return PmsSyncResponse(
            status=result.status,
            pulled_count=len(result.pulled_rates),
            fallback_used=result.fallback_used,
            detail=result.response,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


def _get_property(db: Session, property_id, organization_id) -> Property:
    rental = db.scalar(
        select(Property)
        .where(Property.id == property_id)
        .where(Property.organization_id == organization_id)
    )
    if rental is None:
        raise HTTPException(status_code=404, detail="Property not found")
    return rental


def _get_connection(db: Session, connection_id, organization_id) -> PmsConnection:
    connection = db.scalar(
        select(PmsConnection)
        .where(PmsConnection.id == connection_id)
        .where(PmsConnection.organization_id == organization_id)
    )
    if connection is None:
        raise HTTPException(status_code=404, detail="PMS connection not found")
    return connection


def safe_metadata(metadata: dict) -> dict:
    forbidden = {
        "api_key",
        "access_token",
        "refresh_token",
        "password",
        "client_secret",
        "webhook_secret",
    }
    return {key: value for key, value in metadata.items() if key not in forbidden}
