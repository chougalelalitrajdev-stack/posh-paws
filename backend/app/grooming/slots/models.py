"""Block time (one station, a period) and one day's changes to the start times (Availability › Day)."""

import datetime as dt
from uuid import uuid4

from sqlalchemy import Date, DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class TimeBlock(Base):
    """Time one station can't be booked: a meeting, maintenance, a groomer's day off."""

    __tablename__ = "time_blocks"

    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=lambda: str(uuid4()))
    # ondelete="CASCADE": when a station is removed, the database removes its blocks too.
    station_id: Mapped[str] = mapped_column(ForeignKey("stations.id", ondelete="CASCADE"))
    date: Mapped[dt.date] = mapped_column(Date, index=True)
    time: Mapped[str] = mapped_column(String(5))  # HH:mm
    duration_minutes: Mapped[int]
    reason: Mapped[str] = mapped_column(String(80))
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class DayChanges(Base):
    """Start times staff closed or opened on one date. A row exists only while the day has changes."""

    __tablename__ = "day_slot_changes"

    date: Mapped[dt.date] = mapped_column(Date, primary_key=True)
    closed: Mapped[list[str]] = mapped_column(ARRAY(String(5)), default=list)  # no new bookings start then
    extra: Mapped[list[str]] = mapped_column(ARRAY(String(5)), default=list)  # opened after hours, in the break or off the step
