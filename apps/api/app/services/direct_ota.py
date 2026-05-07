from __future__ import annotations

import asyncio
import base64
import hashlib
import secrets
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from cryptography.fernet import InvalidToken
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db.models import OtaDirectCredential, OtaDirectPlatform, OtaDirectStatus, Property
from app.schemas import PricingPushItem
from app.services.cache import get_redis
from app.services.crypto import CredentialEncryptor
from app.services.notifications import UserNotifier


HIGH_RISK_NOTICE = (
    "This may violate platform TOS and risks account suspension. Use at your own risk. "
    "RentalRadar strongly recommends the Chrome/Safari extension or official PMS APIs instead."
)

PLATFORM_LOGIN_URLS = {
    OtaDirectPlatform.airbnb: "https://www.airbnb.com/login",
    OtaDirectPlatform.vrbo: "https://www.vrbo.com/auth/login",
    OtaDirectPlatform.booking: "https://admin.booking.com/",
}


class DirectOTAPusher:
    def __init__(self, notifier: UserNotifier | None = None) -> None:
        self.notifier = notifier or UserNotifier()

    def store_credentials(
        self,
        db: Session,
        *,
        user_id: UUID,
        property_id: UUID,
        platform: OtaDirectPlatform,
        email: str,
        password: str,
        consent_accepted: bool,
        consent_ip: str | None = None,
    ) -> OtaDirectCredential:
        if not consent_accepted:
            raise ValueError(HIGH_RISK_NOTICE)

        salt = secrets.token_urlsafe(24)
        encrypted = self._encrypt({"email": email, "password": password}, salt)
        credential = db.scalar(
            select(OtaDirectCredential)
            .where(OtaDirectCredential.user_id == user_id)
            .where(OtaDirectCredential.property_id == property_id)
            .where(OtaDirectCredential.platform == platform)
        )
        if credential is None:
            credential = OtaDirectCredential(
                user_id=user_id,
                property_id=property_id,
                platform=platform,
                encrypted_credentials=encrypted,
                encryption_salt=salt,
            )
        else:
            credential.encrypted_credentials = encrypted
            credential.encryption_salt = salt

        credential.status = OtaDirectStatus.pending
        credential.consent_accepted_at = datetime.now(timezone.utc)
        credential.consent_ip = consent_ip
        credential.failure_count = 0
        credential.two_fa_attempts = 0
        credential.last_error = None
        credential.metadata_ = {
            "risk_notice": HIGH_RISK_NOTICE,
            "credential_kind": "email_password",
            "password_stored": True,
        }
        db.add(credential)
        db.commit()
        db.refresh(credential)
        return credential

    def push_rates(
        self,
        *,
        property_id: UUID,
        user_id: UUID,
        rate_calendar: list[PricingPushItem],
        platform: OtaDirectPlatform | None = None,
        dry_run: bool = False,
    ) -> dict[str, Any]:
        from app.workers.tasks import ota_direct_push_task

        payload = [
            {
                "stay_date": item.stay_date.isoformat(),
                "rate_cents": item.rate_cents,
                "pricing_recommendation_id": str(item.pricing_recommendation_id)
                if item.pricing_recommendation_id
                else None,
            }
            for item in rate_calendar
        ]
        async_result = ota_direct_push_task.delay(
            str(property_id),
            str(user_id),
            payload,
            platform.value if platform else None,
            dry_run,
        )
        return {"task_id": async_result.id, "queued": True, "high_risk_notice": HIGH_RISK_NOTICE}

    def handle_2fa(self, property_id: UUID, code: str, user_id: UUID, platform: OtaDirectPlatform | None = None) -> None:
        if not code.isdigit() or len(code) != 6:
            raise ValueError("Enter the 6-digit verification code.")
        redis = get_redis()
        target = platform.value if platform else "*"
        redis.setex(self._two_fa_code_key(user_id, property_id, target), 300, code)

    def revoke(self, db: Session, *, credential_id: UUID, user_id: UUID) -> None:
        credential = db.scalar(
            select(OtaDirectCredential)
            .where(OtaDirectCredential.id == credential_id)
            .where(OtaDirectCredential.user_id == user_id)
        )
        if credential is None:
            return
        credential.status = OtaDirectStatus.revoked
        credential.encrypted_credentials = b"revoked"
        credential.last_error = None
        credential.metadata_ = {"revoked_at": datetime.now(timezone.utc).isoformat()}
        db.add(credential)
        db.commit()

    def decrypt_credentials(self, credential: OtaDirectCredential) -> dict[str, str]:
        try:
            decrypted = CredentialEncryptor.decrypt(
                bytes(credential.encrypted_credentials),
                self._master_key(credential.encryption_salt),
            )
        except InvalidToken as exc:
            raise ValueError("Unable to decrypt direct OTA credentials") from exc
        return {"email": str(decrypted["email"]), "password": str(decrypted["password"])}

    def notify_2fa_required(self, credential: OtaDirectCredential) -> None:
        self.notifier.publish(
            credential.user_id,
            "ota.2fa_required",
            {
                "property_id": str(credential.property_id),
                "platform": credential.platform.value,
                "message": (
                    f"2FA required for your {credential.platform.value.title()} account. "
                    "Please go to RentalRadar -> Connections -> enter the code from your authenticator app."
                ),
            },
        )
        self.notifier.email_2fa_required(credential.user_id, credential.platform.value)

    async def wait_for_2fa_code(
        self,
        *,
        user_id: UUID,
        property_id: UUID,
        platform: OtaDirectPlatform,
        timeout_seconds: int | None = None,
    ) -> str | None:
        redis = get_redis()
        timeout = timeout_seconds or get_settings().ota_2fa_wait_seconds
        keys = [
            self._two_fa_code_key(user_id, property_id, platform.value),
            self._two_fa_code_key(user_id, property_id, "*"),
        ]
        deadline = asyncio.get_running_loop().time() + timeout
        while asyncio.get_running_loop().time() < deadline:
            for key in keys:
                code = redis.get(key)
                if code:
                    redis.delete(key)
                    return str(code)
            await asyncio.sleep(2)
        return None

    def mark_status(
        self,
        db: Session,
        credential: OtaDirectCredential,
        status: OtaDirectStatus,
        *,
        error: str | None = None,
        pushed: bool = False,
    ) -> None:
        credential.status = status
        credential.last_error = error
        if status == OtaDirectStatus.active:
            credential.last_successful_login = datetime.now(timezone.utc)
        if pushed:
            credential.last_push = datetime.now(timezone.utc)
        if status == OtaDirectStatus.failed:
            credential.failure_count += 1
        db.add(credential)
        db.commit()

    def _encrypt(self, credentials: dict[str, str], salt: str) -> bytes:
        return CredentialEncryptor.encrypt(credentials, self._master_key(salt))

    @staticmethod
    def _master_key(salt: str) -> bytes:
        material = f"{get_settings().ota_direct_master_secret}:{salt}".encode()
        return base64.urlsafe_b64encode(hashlib.sha256(material).digest())

    @staticmethod
    def _two_fa_code_key(user_id: UUID, property_id: UUID, platform: str) -> str:
        return f"rentalradar:ota:2fa:{user_id}:{property_id}:{platform}"


def property_for_user(db: Session, property_id: UUID, organization_id: UUID) -> Property:
    rental = db.scalar(
        select(Property)
        .where(Property.id == property_id)
        .where(Property.organization_id == organization_id)
    )
    if rental is None:
        raise ValueError("Property not found")
    return rental


def queue_direct_push_after_recalculation(db: Session, property_id: UUID, recommendations: list[Any]) -> list[dict[str, Any]]:
    """Phase 3 integration hook.

    Only credentials explicitly marked with `metadata.auto_push_enabled=true`
    are queued. This prevents a normal recalculation from surprising users with
    high-risk server-side pushes.
    """

    credentials = list(
        db.scalars(
            select(OtaDirectCredential)
            .where(OtaDirectCredential.property_id == property_id)
            .where(OtaDirectCredential.status == OtaDirectStatus.active)
        ).all()
    )
    queued: list[dict[str, Any]] = []
    for credential in credentials:
        if not (credential.metadata_ or {}).get("auto_push_enabled"):
            continue
        rates = [
            PricingPushItem(
                stay_date=row.stay_date,
                rate_cents=row.recommended_rate_cents,
                pricing_recommendation_id=row.id,
            )
            for row in recommendations
        ]
        queued.append(
            DirectOTAPusher().push_rates(
                property_id=property_id,
                user_id=credential.user_id,
                rate_calendar=rates,
                platform=credential.platform,
                dry_run=False,
            )
        )
    return queued
