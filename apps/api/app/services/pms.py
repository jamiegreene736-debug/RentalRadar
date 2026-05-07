from __future__ import annotations

import hashlib
import hmac
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import (
    PmsConnection,
    PmsConnectionStatus,
    PmsSyncRun,
    PropertyPmsMapping,
    RateObservation,
    RatePush,
    ScrapeSource,
)
from app.integrations import ChannelConnectorRegistry
from app.integrations.types import (
    ChannelPropertyRef,
    ChannelRateUpdate,
    ConnectorCredentials,
    ConnectorError,
    ConnectorResult,
)
from app.services.credentials import CredentialVault


@dataclass(frozen=True)
class PmsPushResult:
    external_request_id: str
    response: dict


class PmsConnectorRegistry:
    """Compatibility wrapper around the production channel connector registry."""

    def __init__(
        self,
        vault: CredentialVault | None = None,
        registry: ChannelConnectorRegistry | None = None,
    ) -> None:
        self.vault = vault or CredentialVault()
        self.registry = registry or ChannelConnectorRegistry()

    def exchange_oauth_code(
        self,
        provider: str,
        oauth_code: str,
        redirect_uri: str | None,
    ) -> tuple[str, str | None, str]:
        # Provider-specific OAuth adapters can replace this exchange. The
        # connection endpoint stores the resulting tokens encrypted either way.
        account_ref = f"{provider}_oauth_{oauth_code[-8:]}"
        return f"access_{oauth_code}", f"refresh_{oauth_code}", account_ref

    def test_connection(
        self,
        provider,
        credentials_payload: dict,
        metadata: dict | None = None,
    ) -> ConnectorResult:
        credentials = ConnectorCredentials(
            provider=provider,
            api_key=credentials_payload.get("api_key"),
            access_token=credentials_payload.get("access_token"),
            refresh_token=credentials_payload.get("refresh_token"),
            client_id=credentials_payload.get("client_id"),
            client_secret=credentials_payload.get("client_secret"),
            webhook_secret=credentials_payload.get("webhook_secret"),
        )
        connector = self.registry.connector_for(credentials, metadata)
        return connector.test_connection()

    def pull_rates(
        self,
        db: Session,
        connection_id: UUID,
        property_id: UUID,
        start_date: date,
        end_date: date,
    ) -> ConnectorResult:
        connection = _connection(db, connection_id)
        mapping = _mapping(db, connection_id, property_id)
        sync_run = _sync_run(db, connection, property_id, "pull_rates")
        try:
            credentials = self.vault.unpack(connection)
            connector = self.registry.connector_for(credentials, connection.metadata_)
            property_ref = _property_ref(mapping)
            rates = connector.pull_rates(property_ref, start_date, end_date)
            fallback_used = False

            for rate in rates:
                db.add(
                    RateObservation(
                        property_id=property_id,
                        competitor_id=None,
                        scrape_job_id=None,
                        scrape_snapshot_id=None,
                        source=_source_for_connection(connection),
                        stay_date=rate.stay_date,
                        currency_code=rate.currency_code,
                        nightly_rate_cents=rate.rate_cents,
                        total_rate_cents=rate.rate_cents,
                        fees_cents=None,
                        taxes_cents=None,
                        available=rate.available,
                        min_nights=rate.min_stay,
                        max_nights=rate.max_stay,
                        cancellation_policy=None,
                        extraction_confidence=0.96 if not fallback_used else 0.78,
                        raw_payload=rate.raw_payload | {
                            "provider": connection.provider.value,
                            "sync_run_id": str(sync_run.id),
                        },
                    )
                )

            sync_run.status = "succeeded"
            sync_run.fallback_used = fallback_used
            sync_run.pulled_count = len(rates)
            sync_run.completed_at = datetime.now(timezone.utc)
            connection.last_sync_at = sync_run.completed_at
            db.commit()
            return ConnectorResult(
                provider=connection.provider,
                status="succeeded",
                pulled_rates=rates,
                fallback_used=fallback_used,
                response={"sync_run_id": str(sync_run.id), "pulled_count": len(rates)},
            )
        except Exception as exc:
            _fail_sync(db, sync_run, exc)
            raise

    def push_rate(self, db: Session, rate_push_id: UUID) -> PmsPushResult:
        rate_push = db.get(RatePush, rate_push_id)
        if rate_push is None:
            raise ValueError(f"Rate push {rate_push_id} not found")
        result = self.push_rates(db, rate_push.pms_connection_id, rate_push.property_id, [
            ChannelRateUpdate(
                stay_date=rate_push.stay_date,
                rate_cents=rate_push.rate_cents,
                currency_code=rate_push.currency_code,
            )
        ])
        rate_push.status = "succeeded" if result.status == "succeeded" else "failed"
        rate_push.external_request_id = result.external_request_id
        rate_push.external_response = result.response
        rate_push.pushed_at = datetime.now(timezone.utc) if result.status == "succeeded" else None
        db.commit()
        return PmsPushResult(
            external_request_id=result.external_request_id or f"rr_{uuid4()}",
            response=result.response,
        )

    def push_rates(
        self,
        db: Session,
        connection_id: UUID,
        property_id: UUID,
        updates: list[ChannelRateUpdate],
    ) -> ConnectorResult:
        connection = _connection(db, connection_id)
        mapping = _mapping(db, connection_id, property_id)
        sync_run = _sync_run(db, connection, property_id, "push_rates")
        try:
            credentials = self.vault.unpack(connection)
            connector = self.registry.connector_for(credentials, connection.metadata_)
            property_ref = _property_ref(mapping)
            result = connector.push_rates(property_ref, updates)

            sync_run.status = result.status
            sync_run.fallback_used = result.fallback_used
            sync_run.pushed_count = len(updates) if result.status == "succeeded" else 0
            sync_run.skipped_count = len(updates) if result.status == "skipped" else 0
            sync_run.response_summary = result.response | {"external_request_id": result.external_request_id}
            sync_run.completed_at = datetime.now(timezone.utc)
            connection.last_sync_at = sync_run.completed_at
            db.commit()
            return result
        except Exception as exc:
            _fail_sync(db, sync_run, exc)
            raise

    def two_way_sync(
        self,
        db: Session,
        connection_id: UUID,
        property_id: UUID,
        start_date: date,
        end_date: date,
        updates: list[ChannelRateUpdate],
    ) -> dict:
        pulled = self.pull_rates(db, connection_id, property_id, start_date, end_date)
        pushed = self.push_rates(db, connection_id, property_id, updates) if updates else None
        return {
            "pull": pulled.response,
            "push": pushed.response if pushed else None,
            "fallback_used": pulled.fallback_used or bool(pushed and pushed.fallback_used),
        }

    def handle_webhook(
        self,
        db: Session,
        connection_id: UUID,
        provider,
        payload: dict,
        raw_body: bytes,
        signature: str | None,
        shared_secret_header: str | None,
    ) -> dict:
        connection = _connection(db, connection_id)
        if connection.provider != provider:
            raise ConnectorError("Webhook provider does not match PMS connection")
        credentials = self.vault.unpack(connection)
        _verify_webhook_secret(credentials.webhook_secret, raw_body, signature, shared_secret_header)

        external_property_id = _payload_property_id(payload)
        mapping = None
        if external_property_id:
            mapping = db.scalar(
                select(PropertyPmsMapping)
                .where(PropertyPmsMapping.pms_connection_id == connection.id)
                .where(PropertyPmsMapping.external_property_id == external_property_id)
                .where(PropertyPmsMapping.active.is_(True))
            )

        sync_run = _sync_run(db, connection, mapping.property_id if mapping else None, "webhook")
        sync_run.status = "succeeded"
        sync_run.completed_at = datetime.now(timezone.utc)
        sync_run.response_summary = {
            "event_type": payload.get("event") or payload.get("type"),
            "external_property_id": external_property_id,
            "payload_keys": sorted(payload.keys())[:20],
        }
        connection.last_sync_at = sync_run.completed_at
        db.commit()
        return {
            "received": True,
            "sync_run_id": str(sync_run.id),
            "property_id": str(mapping.property_id) if mapping else None,
            "should_refresh": mapping is not None,
        }

    def queue_public_listing_baseline(
        self,
        db: Session,
        organization_id: UUID,
        property_id: UUID,
        public_listing_urls: list[str],
    ) -> list[UUID]:
        from app.db.models import ScrapeJob, ScrapeJobStatus
        from app.services.market import infer_source

        existing_connection = db.scalar(
            select(PmsConnection)
            .join(PropertyPmsMapping, PropertyPmsMapping.pms_connection_id == PmsConnection.id)
            .where(PmsConnection.organization_id == organization_id)
            .where(PropertyPmsMapping.property_id == property_id)
            .where(PmsConnection.status == PmsConnectionStatus.connected)
            .where(PropertyPmsMapping.active.is_(True))
        )
        if existing_connection:
            raise ConnectorError("Official PMS connection exists; use PMS sync instead of public listing fallback")

        jobs: list[ScrapeJob] = []
        for url in public_listing_urls:
            source = infer_source(url)
            if source.value not in {"airbnb", "vrbo"}:
                raise ConnectorError("Fallback baseline only supports the user's own public Airbnb/VRBO listing URLs")
            job = ScrapeJob(
                organization_id=organization_id,
                property_id=property_id,
                source=source,
                target_url=url,
                stay_date_start=date.today(),
                stay_date_end=date.today() + timedelta(days=365),
                status=ScrapeJobStatus.queued,
                request_context={"trigger": "public_listing_baseline", "legal_basis": "user_supplied_public_listing"},
            )
            db.add(job)
            jobs.append(job)
        db.commit()
        for job in jobs:
            db.refresh(job)
        return [job.id for job in jobs]


def _connection(db: Session, connection_id: UUID) -> PmsConnection:
    connection = db.get(PmsConnection, connection_id)
    if connection is None:
        raise ValueError(f"PMS connection {connection_id} not found")
    return connection


def _mapping(db: Session, connection_id: UUID, property_id: UUID) -> PropertyPmsMapping:
    mapping = db.scalar(
        select(PropertyPmsMapping)
        .where(PropertyPmsMapping.pms_connection_id == connection_id)
        .where(PropertyPmsMapping.property_id == property_id)
        .where(PropertyPmsMapping.active.is_(True))
    )
    if mapping is None:
        raise ConnectorError("Property is not mapped to this PMS/channel connection")
    return mapping


def _property_ref(mapping: PropertyPmsMapping) -> ChannelPropertyRef:
    return ChannelPropertyRef(
        external_property_id=mapping.external_property_id,
        external_channel_ids=mapping.external_channel_ids or {},
    )


def _sync_run(
    db: Session,
    connection: PmsConnection,
    property_id: UUID | None,
    direction: str,
) -> PmsSyncRun:
    sync_run = PmsSyncRun(
        organization_id=connection.organization_id,
        pms_connection_id=connection.id,
        property_id=property_id,
        direction=direction,
        provider=connection.provider.value,
        status="running",
        started_at=datetime.now(timezone.utc),
    )
    db.add(sync_run)
    db.flush()
    return sync_run


def _fail_sync(db: Session, sync_run: PmsSyncRun, exc: Exception) -> None:
    sync_run.status = "failed"
    sync_run.error_message = str(exc)
    sync_run.completed_at = datetime.now(timezone.utc)
    db.commit()


def _source_for_connection(connection: PmsConnection) -> ScrapeSource:
    try:
        return ScrapeSource(connection.provider.value)
    except ValueError:
        if connection.provider.value in {"lodgify", "hostfully"}:
            return ScrapeSource.direct_pms
        return ScrapeSource.other


def _payload_property_id(payload: dict) -> str | None:
    for key in ("propertyId", "property_id", "listingId", "listing_id", "unitId", "unit_id"):
        value = payload.get(key)
        if value:
            return str(value)
    nested = payload.get("data") or payload.get("payload") or {}
    if isinstance(nested, dict):
        return _payload_property_id(nested)
    return None


def _verify_webhook_secret(
    webhook_secret: str | None,
    raw_body: bytes,
    signature: str | None,
    shared_secret_header: str | None,
) -> None:
    if not webhook_secret:
        return
    if shared_secret_header and hmac.compare_digest(shared_secret_header, webhook_secret):
        return
    if signature:
        expected = hmac.new(webhook_secret.encode(), raw_body, hashlib.sha256).hexdigest()
        candidates = {signature, signature.removeprefix("sha256=")}
        if any(hmac.compare_digest(candidate, expected) for candidate in candidates):
            return
    raise ConnectorError("Invalid PMS webhook signature")
