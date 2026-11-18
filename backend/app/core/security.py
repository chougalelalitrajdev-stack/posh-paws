"""Passwords and sign-in tokens.

Passwords are never stored: only a salted scrypt hash ("fingerprint"), checked by hashing what was typed the same way.
A sign-in token is a JWT signed with SECRET_KEY: it says who someone is and until when, and can't be changed without
the signature breaking.
"""

import base64
import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone

import jwt

from app.core.config import settings

# scrypt cost: memory- and time-hungry on purpose, so guessing passwords in bulk is impractical.
_N, _R, _P = 2**14, 8, 1


def hash_password(password: str) -> str:
    """Stored as "scrypt$<salt>$<hash>"; the random salt makes equal passwords hash differently."""
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=_N, r=_R, p=_P)
    return f"scrypt${base64.b64encode(salt).decode()}${base64.b64encode(digest).decode()}"


def verify_password(password: str, stored: str | None) -> bool:
    if not stored or not stored.startswith("scrypt$"):
        return False
    _, salt, digest = stored.split("$")
    attempt = hashlib.scrypt(password.encode(), salt=base64.b64decode(salt), n=_N, r=_R, p=_P)
    # compare_digest takes the same time whether the first or the last byte differs, so timing gives nothing away.
    return hmac.compare_digest(attempt, base64.b64decode(digest))


def create_token(claims: dict) -> str:
    """A signed token carrying `claims` (who, which role) that expires after TOKEN_DAYS."""
    expires = datetime.now(timezone.utc) + timedelta(days=settings.token_days)
    return jwt.encode({**claims, "exp": expires}, settings.secret_key, algorithm="HS256")


def read_token(token: str) -> dict | None:
    """The claims of a genuine, unexpired token; None if it was changed, signed with another key or has expired."""
    try:
        return jwt.decode(token, settings.secret_key, algorithms=["HS256"])
    except jwt.PyJWTError:
        return None
