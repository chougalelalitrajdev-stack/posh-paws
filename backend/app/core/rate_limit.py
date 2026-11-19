"""Limits against guessing and flooding (sign-in attempts, login codes): the database remembers recent attempts per key,
e.g. "staff-login:meera@poshpaws.in" or "otp-send-ip:203.0.113.7", and refuses once there are too many in a time window."""

import datetime as dt

from fastapi import HTTPException, Request
from sqlalchemy import DateTime, String, delete, func, select
from sqlalchemy.orm import Mapped, Session, mapped_column

from app.core.database import Base


def _utc_now() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


class Attempt(Base):
    """One attempt counted against a limit. Rows older than a day are removed as new ones come in."""

    __tablename__ = "attempts"

    id: Mapped[int] = mapped_column(primary_key=True)
    key: Mapped[str] = mapped_column(String(120), index=True)
    at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=_utc_now, index=True)


def client_ip(request: Request) -> str:
    """Where a request comes from. Online, the host's proxy passes the real address on (uvicorn --proxy-headers)."""
    return request.client.host if request.client else "unknown"


def check(db: Session, key: str, limit: int, window: dt.timedelta, message: str) -> None:
    """429 Too Many Requests once `key` has `limit` attempts within `window`."""
    recent = db.scalar(select(func.count()).select_from(Attempt).where(Attempt.key == key, Attempt.at > _utc_now() - window))
    if recent >= limit:
        raise HTTPException(status_code=429, detail=message)


def count(db: Session, *keys: str) -> None:
    """Counts one attempt against each key (the caller commits)."""
    db.execute(delete(Attempt).where(Attempt.at < _utc_now() - dt.timedelta(days=1)))
    db.add_all(Attempt(key=key) for key in keys)


def forget(db: Session, key: str) -> None:
    """Clears a key's attempts (e.g. after a successful sign-in)."""
    db.execute(delete(Attempt).where(Attempt.key == key))
