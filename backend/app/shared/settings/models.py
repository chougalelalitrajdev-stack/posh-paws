"""The settings table (one row per section, its options as a JSON document) and the closures table (one row per holiday)."""

import datetime as dt
from uuid import uuid4

from sqlalchemy import Date, DateTime, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class SettingsRow(Base):
    """A single set of options (business, booking, payments, notifications, app), always read and saved whole."""

    __tablename__ = "settings"

    section: Mapped[str] = mapped_column(String(30), primary_key=True)
    # JSONB: the section's options as one JSON document inside the row.
    value: Mapped[dict] = mapped_column(JSONB)
    updated_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    updated_by: Mapped[str | None] = mapped_column(String(80))


class Closure(Base):
    """A holiday: closed all day, or closing early at closes_at. One per date."""

    __tablename__ = "closures"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    date: Mapped[dt.date] = mapped_column(Date, unique=True, index=True)
    name: Mapped[str] = mapped_column(String(80))
    closes_at: Mapped[str | None] = mapped_column(String(5))  # HH:mm
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
