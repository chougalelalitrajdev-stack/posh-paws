"""Memberships: a customer on a plan, one period at a time, and the history of plan changes."""

import datetime as dt

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, Index, Sequence, String, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.grooming.plans.models import Plan
from app.shared.customers.models import Customer
from app.shared.payments.models import Payment, PaymentLink

SUBSCRIPTION_NUMBER = Sequence("subscription_number", start=101, metadata=Base.metadata)  # SUB-101, SUB-102, ...


def _utc_now() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


class Subscription(Base):
    """A customer's membership. Sessions and price are this period's; a new plan price reaches them when they renew."""

    __tablename__ = "subscriptions"
    __table_args__ = (
        CheckConstraint("status in ('active', 'payment_pending', 'expired', 'cancelled')", name="subscription_status_known"),
        # One running membership per customer: the database refuses a second active or pending one (a "partial unique index").
        Index("one_membership_per_customer", "customer_id", unique=True, postgresql_where=text("status in ('active', 'payment_pending')")),
    )

    id: Mapped[str] = mapped_column(String(12), primary_key=True)  # SUB-101
    customer_id: Mapped[str] = mapped_column(ForeignKey("customers.id"), index=True)
    plan_id: Mapped[str] = mapped_column(ForeignKey("plans.id"))
    plan_name: Mapped[str] = mapped_column(String(40))  # as they joined or last changed
    price_paise: Mapped[int]  # what this member pays per period
    sessions_total: Mapped[int | None]  # this period; None = unlimited
    sessions_used: Mapped[int] = mapped_column(default=0)
    started_on: Mapped[dt.date] = mapped_column(Date)
    renews_on: Mapped[dt.date | None] = mapped_column(Date)
    ended_on: Mapped[dt.date | None] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(16))
    next_plan_id: Mapped[str | None] = mapped_column(ForeignKey("plans.id"))  # a downgrade waiting for the next renewal
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=_utc_now)

    customer: Mapped[Customer] = relationship()
    plan: Mapped[Plan] = relationship(foreign_keys=[plan_id])
    next_plan: Mapped[Plan | None] = relationship(foreign_keys=[next_plan_id])
    changes: Mapped[list["PlanChange"]] = relationship(order_by="PlanChange.id.desc()")
    payments: Mapped[list[Payment]] = relationship(order_by=Payment.at)
    links: Mapped[list[PaymentLink]] = relationship(order_by=PaymentLink.sent_at)


class PlanChange(Base):
    """One plan change. upgrade: starts now, the difference is paid now · downgrade: starts at renewal ·
    switch: before the first payment, free · keep: a waiting downgrade was called off."""

    __tablename__ = "plan_changes"
    __table_args__ = (CheckConstraint("kind in ('upgrade', 'downgrade', 'switch', 'keep')", name="plan_change_kind_known"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    subscription_id: Mapped[str] = mapped_column(ForeignKey("subscriptions.id"), index=True)
    at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=_utc_now)
    kind: Mapped[str] = mapped_column(String(10))
    from_plan: Mapped[str] = mapped_column(String(40))
    to_plan: Mapped[str] = mapped_column(String(40))
    paid_paise: Mapped[int] = mapped_column(default=0)  # upgrade: the difference paid now
    method: Mapped[str | None] = mapped_column(String(8))  # how the difference was paid (shop QR, cash, card)
    by: Mapped[str] = mapped_column(String(80))
