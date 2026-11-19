"""The login_codes table: one row per one-time code sent to a phone."""

import datetime as dt

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


def _utc_now() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


class LoginCode(Base):
    """A 6-digit code sent to a phone. Like a password, only its hash (fingerprint) is kept, never the code itself."""

    __tablename__ = "login_codes"

    id: Mapped[int] = mapped_column(primary_key=True)
    phone: Mapped[str] = mapped_column(String(10), index=True)
    code_hash: Mapped[str] = mapped_column(String(200))
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=_utc_now)
    expires_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True))
    attempts: Mapped[int] = mapped_column(default=0)  # wrong codes typed; after 5 the code stops working
    # When the right code was typed: proof the person has this phone (a new customer then has a few minutes to sign up).
    verified_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True))
