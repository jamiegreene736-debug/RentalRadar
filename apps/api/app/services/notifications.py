from __future__ import annotations

import json
import logging
from typing import Any
from uuid import UUID

from app.config import get_settings
from app.services.cache import get_redis

logger = logging.getLogger(__name__)


class UserNotifier:
    """Realtime/email notification seam.

    Production can swap the email placeholder for Resend, Postmark, SES, or
    Supabase Edge Functions. Payloads must never include passwords, cookies, or
    browser storage state.
    """

    def publish(self, user_id: UUID, event: str, payload: dict[str, Any]) -> None:
        safe_payload = {"event": event, **payload}
        redis = get_redis()
        message = json.dumps(safe_payload, default=str)
        redis.publish(f"rentalradar:user:{user_id}:events", message)
        redis.lpush(f"rentalradar:user:{user_id}:notifications", message)
        redis.ltrim(f"rentalradar:user:{user_id}:notifications", 0, 49)

    def email_2fa_required(self, user_id: UUID, platform: str) -> None:
        settings = get_settings()
        # Placeholder for the production email provider. This deliberately logs
        # only routing metadata and the template key, never credentials/session data.
        logger.info(
            "email.queued",
            extra={
                "template": "ota_2fa_required",
                "user_id": str(user_id),
                "platform": platform,
                "from": settings.ota_notification_email_from,
            },
        )
