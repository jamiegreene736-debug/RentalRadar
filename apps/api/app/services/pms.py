from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy.orm import Session

from app.db.models import PmsConnection, RatePush
from app.services.crypto import TokenCipher


@dataclass(frozen=True)
class PmsPushResult:
    external_request_id: str
    response: dict


class PmsConnectorRegistry:
    def __init__(self, cipher: TokenCipher | None = None) -> None:
        self.cipher = cipher or TokenCipher()

    def exchange_oauth_code(
        self,
        provider: str,
        oauth_code: str,
        redirect_uri: str | None,
    ) -> tuple[str, str | None, str]:
        # Replace with provider-specific OAuth implementations.
        account_ref = f"{provider}_oauth_{oauth_code[-8:]}"
        return f"access_{oauth_code}", f"refresh_{oauth_code}", account_ref

    def push_rate(self, db: Session, rate_push_id: UUID) -> PmsPushResult:
        rate_push = db.get(RatePush, rate_push_id)
        if rate_push is None:
            raise ValueError(f"Rate push {rate_push_id} not found")
        connection = db.get(PmsConnection, rate_push.pms_connection_id)
        if connection is None:
            raise ValueError(f"PMS connection {rate_push.pms_connection_id} not found")

        access_token = self.cipher.decrypt(connection.access_token_encrypted)
        if not access_token:
            raise ValueError("PMS connection does not have an access token")

        external_request_id = f"rr_{uuid4()}"
        response = {
            "provider": connection.provider.value,
            "property_id": str(rate_push.property_id),
            "stay_date": rate_push.stay_date.isoformat(),
            "rate_cents": rate_push.rate_cents,
            "status": "accepted",
        }
        rate_push.status = "succeeded"
        rate_push.external_request_id = external_request_id
        rate_push.external_response = response
        rate_push.pushed_at = datetime.now(timezone.utc)
        db.commit()
        return PmsPushResult(external_request_id=external_request_id, response=response)
