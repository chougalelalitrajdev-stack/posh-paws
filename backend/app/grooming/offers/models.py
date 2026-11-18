"""The offers table: one row per discount or coupon code (Catalog › Offers)."""

import datetime as dt
from uuid import uuid4

from sqlalchemy import Boolean, CheckConstraint, Date, DateTime, String, func
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Offer(Base):
    """A discount, applied automatically or with a code. Its status (live, scheduled, ...) is worked out when it's read."""

    __tablename__ = "offers"
    __table_args__ = (
        CheckConstraint("discount_type in ('percent', 'flat')", name="offer_discount_type_known"),
        CheckConstraint("applies_to in ('all_services', 'some_services', 'plans')", name="offer_applies_to_known"),
    )

    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=lambda: str(uuid4()))
    title: Mapped[str] = mapped_column(String(80))
    discount_type: Mapped[str] = mapped_column(String(7))
    value: Mapped[int]  # percent (e.g. 15), or paise for a flat discount
    # None = applied automatically. Upper-case; unique=True makes the database refuse a second offer with the same code.
    code: Mapped[str | None] = mapped_column(String(20), unique=True)
    applies_to: Mapped[str] = mapped_column(String(20))
    service_ids: Mapped[list[str]] = mapped_column(ARRAY(String(40)), default=list)  # applies_to = 'some_services'
    starts_on: Mapped[dt.date] = mapped_column(Date)
    ends_on: Mapped[dt.date | None] = mapped_column(Date)  # None = no end
    total_uses: Mapped[int | None]  # None = no limit
    per_customer: Mapped[int | None]
    new_customers_only: Mapped[bool] = mapped_column(Boolean, default=False)
    draft: Mapped[bool] = mapped_column(Boolean, default=False)
    paused: Mapped[bool] = mapped_column(Boolean, default=False)
    # Times it's been used: counted when a booking is confirmed, given back on cancel (bookings, Module 5).
    used: Mapped[int] = mapped_column(default=0)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
