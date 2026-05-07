from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from typing import Any

from app.db.models import PmsProvider


@dataclass(frozen=True)
class ChannelRate:
    stay_date: date
    rate_cents: int | None
    available: bool | None
    min_stay: int | None = None
    max_stay: int | None = None
    currency_code: str = "USD"
    raw_payload: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class ChannelRateUpdate:
    stay_date: date
    rate_cents: int
    min_stay: int | None = None
    available: bool | None = None
    currency_code: str = "USD"
    channel: str | None = None


@dataclass(frozen=True)
class ChannelPropertyRef:
    external_property_id: str
    external_channel_ids: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class ConnectorCredentials:
    provider: PmsProvider
    access_token: str | None = None
    refresh_token: str | None = None
    api_key: str | None = None
    username: str | None = None
    password: str | None = None
    client_id: str | None = None
    client_secret: str | None = None
    webhook_secret: str | None = None
    extra: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class ProviderCapabilities:
    pull_rates: bool
    push_rates: bool
    pull_reservations: bool
    ota_direct: bool = False
    requires_partner_certification: bool = False
    supports_playwright_fallback: bool = False


@dataclass(frozen=True)
class ConnectorResult:
    provider: PmsProvider
    status: str
    external_request_id: str | None = None
    pulled_rates: list[ChannelRate] = field(default_factory=list)
    response: dict[str, Any] = field(default_factory=dict)
    fallback_used: bool = False
    skipped_reason: str | None = None


class ConnectorError(RuntimeError):
    pass


class PartnerAccessRequired(ConnectorError):
    pass


class CredentialError(ConnectorError):
    pass
