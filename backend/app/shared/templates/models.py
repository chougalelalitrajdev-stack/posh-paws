"""The message_templates table: one row per WhatsApp message."""

import datetime as dt

from sqlalchemy import Boolean, CheckConstraint, DateTime, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class MessageTemplate(Base):
    __tablename__ = "message_templates"
    __table_args__ = (CheckConstraint("approval in ('approved', 'pending', 'draft')", name="template_approval_known"),)

    key: Mapped[str] = mapped_column(String(40), primary_key=True)  # e.g. booking_reminder
    group: Mapped[str] = mapped_column(String(20))  # Bookings | Membership
    name: Mapped[str] = mapped_column(String(80))
    body: Mapped[str] = mapped_column(Text)
    # False for messages staff send by hand from a screen.
    can_auto_send: Mapped[bool] = mapped_column(Boolean)
    auto_send: Mapped[bool] = mapped_column(Boolean)
    # WhatsApp checks a text before it can go out automatically; staff can always send it by hand.
    approval: Mapped[str] = mapped_column(String(20))
    sort_order: Mapped[int]
    updated_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_by: Mapped[str] = mapped_column(String(80))
