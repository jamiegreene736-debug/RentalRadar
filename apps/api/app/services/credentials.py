from __future__ import annotations

import hashlib
import json
from typing import Any

from app.db.models import PmsConnection, PmsProvider
from app.integrations.types import ConnectorCredentials
from app.services.crypto import TokenCipher


SECRET_FIELDS = {
    "api_key",
    "access_token",
    "refresh_token",
    "username",
    "password",
    "client_id",
    "client_secret",
    "webhook_secret",
}


class CredentialVault:
    def __init__(self, cipher: TokenCipher | None = None) -> None:
        self.cipher = cipher or TokenCipher()

    def pack(self, provider: PmsProvider, values: dict[str, Any]) -> tuple[dict[str, str], str]:
        secret_values: dict[str, str] = {}
        fingerprint_source: dict[str, str] = {}
        for field in SECRET_FIELDS:
            value = values.get(field)
            if value:
                secret_values[field] = str(value)
                fingerprint_source[field] = hashlib.sha256(str(value).encode()).hexdigest()
        fingerprint = hashlib.sha256(
            json.dumps({"provider": provider.value, "fields": fingerprint_source}, sort_keys=True).encode()
        ).hexdigest()
        if not secret_values:
            return {}, fingerprint
        return {"payload": self.cipher.encrypt_credentials(secret_values)}, fingerprint

    def unpack(self, connection: PmsConnection) -> ConnectorCredentials:
        payload = connection.credentials_encrypted or {}
        if "payload" in payload:
            decrypted = self.cipher.decrypt_credentials(payload["payload"])
        else:
            decrypted = {key: self.cipher.decrypt(value) for key, value in payload.items()}
        return ConnectorCredentials(
            provider=connection.provider,
            access_token=decrypted.get("access_token") or self.cipher.decrypt(connection.access_token_encrypted),
            refresh_token=decrypted.get("refresh_token") or self.cipher.decrypt(connection.refresh_token_encrypted),
            api_key=decrypted.get("api_key"),
            username=decrypted.get("username"),
            password=decrypted.get("password"),
            client_id=decrypted.get("client_id"),
            client_secret=decrypted.get("client_secret"),
            webhook_secret=decrypted.get("webhook_secret") or self.cipher.decrypt(connection.webhook_secret_encrypted),
            extra={key: value for key, value in decrypted.items() if key not in SECRET_FIELDS},
        )
