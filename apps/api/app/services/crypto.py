from __future__ import annotations

import base64
import hashlib
import json
from typing import Dict

from cryptography.fernet import Fernet, InvalidToken

from app.config import get_settings


class CredentialEncryptor:
    @staticmethod
    def generate_key() -> bytes:
        return Fernet.generate_key()

    @staticmethod
    def encrypt(credentials: Dict, master_key: bytes) -> bytes:
        f = Fernet(master_key)
        json_data = json.dumps(credentials).encode()
        return f.encrypt(json_data)

    @staticmethod
    def decrypt(encrypted_data: bytes, master_key: bytes) -> Dict:
        f = Fernet(master_key)
        decrypted = f.decrypt(encrypted_data)
        return json.loads(decrypted)


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
        self.master_key = _fernet_key(get_settings().token_encryption_key)

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

    def encrypt_credentials(self, credentials: Dict) -> str:
        return CredentialEncryptor.encrypt(credentials, self.master_key).decode()

    def decrypt_credentials(self, encrypted_data: str) -> Dict:
        try:
            return CredentialEncryptor.decrypt(encrypted_data.encode(), self.master_key)
        except InvalidToken as exc:
            raise ValueError("Unable to decrypt PMS credentials") from exc
