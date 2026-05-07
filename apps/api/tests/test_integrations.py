from __future__ import annotations

from datetime import date
from uuid import uuid4

import pytest

from app.db.models import PmsConnection, PmsConnectionStatus, PmsProvider
from app.integrations.registry import ChannelConnectorRegistry
from app.integrations.providers import AirbnbPartnerConnector, normalize_rate_payload
from app.integrations.types import (
    ChannelPropertyRef,
    ConnectorCredentials,
    PartnerAccessRequired,
)
from app.services.credentials import CredentialVault


def test_credentials_are_encrypted_and_round_trip() -> None:
    vault = CredentialVault()
    encrypted, fingerprint = vault.pack(
        PmsProvider.guesty,
        {
            "access_token": "secret-token",
            "refresh_token": "secret-refresh",
            "api_key": "secret-api-key",
        },
    )

    assert fingerprint
    assert "secret-token" not in str(encrypted)

    connection = PmsConnection(
        id=uuid4(),
        organization_id=uuid4(),
        provider=PmsProvider.guesty,
        account_ref="acct",
        display_name="Guesty",
        status=PmsConnectionStatus.connected,
        credentials_encrypted=encrypted,
        token_cipher="fernet:sha256-env-key",
        scopes=[],
        metadata_={},
    )
    credentials = vault.unpack(connection)
    assert credentials.access_token == "secret-token"
    assert credentials.refresh_token == "secret-refresh"
    assert credentials.api_key == "secret-api-key"


def test_normalize_rate_payload_accepts_common_calendar_shapes() -> None:
    rates = normalize_rate_payload(
        {
            "result": {
                "days": [
                    {"date": "2026-06-01", "price": 249.5, "available": True, "minStay": 2},
                    {"stayDate": "2026-06-02", "rateCents": 26000, "available": False},
                ]
            }
        }
    )

    assert len(rates) == 2
    assert rates[0].stay_date == date(2026, 6, 1)
    assert rates[0].rate_cents == 24950
    assert rates[0].min_stay == 2
    assert rates[1].rate_cents == 26000


def test_ota_direct_connector_requires_partner_endpoint() -> None:
    connector = AirbnbPartnerConnector(
        ConnectorCredentials(provider=PmsProvider.airbnb, access_token="token"),
        metadata={},
    )
    with pytest.raises(PartnerAccessRequired):
        connector.pull_rates(
            ChannelPropertyRef(external_property_id="listing-1"),
            date(2026, 6, 1),
            date(2026, 6, 2),
        )


def test_new_pms_connectors_are_registered() -> None:
    registry = ChannelConnectorRegistry()
    for provider in (PmsProvider.hostaway, PmsProvider.streamline, PmsProvider.ciirus):
        connector = registry.connector_for(
            ConnectorCredentials(provider=provider, api_key="official-api-key"),
            metadata={"base_url": "https://example.invalid", "validation_path": "/health"},
        )
        assert connector.provider == provider
