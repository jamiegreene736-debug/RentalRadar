from __future__ import annotations

import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken

from app.config import get_settings


def _fernet_key(raw_key: str) -> bytes:
    if raw_key.startswith("gAAAA"):
        return raw_key.encode()
    if len(raw_key) == 44:
        return raw_key.encode()
    digest = hashlib.sha256(raw_key.encode()).digest()
    return base64.urlsafe_b64encode(digest)


class TokenCipher:
    def __init__(self) -> None:
        self.fernet = Fernet(_fernet_key(get_settings().token_encryption_key))

    def encrypt(self, plaintext: str | None) -> str | None:
        if plaintext is None:
            return None
        return self.fernet.encrypt(plaintext.encode()).decode()

    def decrypt(self, ciphertext: str | None) -> str | None:
        if ciphertext is None:
            return None
        try:
            return self.fernet.decrypt(ciphertext.encode()).decode()
        except InvalidToken as exc:
            raise ValueError("Unable to decrypt PMS token") from exc
