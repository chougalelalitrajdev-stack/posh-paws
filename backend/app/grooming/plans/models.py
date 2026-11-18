"""The plans table: one row per membership plan (Catalog › Membership plans)."""

import datetime as dt
from uuid import uuid4

from sqlalchemy import Boolean, CheckConstraint, DateTime, String, func
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Plan(Base):
    """A membership plan. A saved price reaches current members at their next renewal (subscriptions, Module 7)."""

    __tablename__ = "plans"
    __table_args__ = (CheckConstraint("billing in ('month', 'quarter', 'year')", name="plan_billing_known"),)

    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=lambda: str(uuid4()))
    name: Mapped[str] = mapped_column(String(40))
    tagline: Mapped[str] = mapped_column(String(120), default="")
    price_paise: Mapped[int]
    billing: Mapped[str] = mapped_column(String(10))
    sessions_per_period: Mapped[int | None]  # None = unlimited
    discount_percent: Mapped[int]  # off any other service
    eligible_service_ids: Mapped[list[str]] = mapped_column(ARRAY(String(40)), default=list)  # services a plan session covers
    # Shown to customers in order, e.g. [{"text": "Priority slot booking", "included": false}]. Always read and saved whole, so JSONB.
    benefits: Mapped[list[dict]] = mapped_column(JSONB, default=list)
    featured: Mapped[bool] = mapped_column(Boolean, default=False)  # the "Most popular" badge, one plan at a time
    subscribable: Mapped[bool] = mapped_column(Boolean, default=True)  # customers can join it in the app
    sort_order: Mapped[int]
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
