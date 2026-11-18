"""Money in and out (payments and refunds) and payment links, for anything the business sells.

Each row says what it was for with a column per kind of thing: booking_id and subscription_id now; store orders and vet visits
add their own column later. So Payments, refunds and the payment gateway work once for everything.
"""

import datetime as dt
from uuid import uuid4

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base

METHODS = ("online", "upi_qr", "cash", "card")  # online = a payment link or the app; the rest are taken at the shop


def _utc_now() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


class Payment(Base):
    """Money received (an advance or a balance) or given back (a refund of one of them). Amounts are positive."""

    __tablename__ = "payments"
    __table_args__ = (
        CheckConstraint("kind in ('advance', 'balance', 'plan', 'upgrade', 'refund')", name="payment_kind_known"),
        CheckConstraint(f"method in {METHODS}", name="payment_method_known"),
        CheckConstraint("amount_paise > 0", name="payment_amount_positive"),
    )

    id: Mapped[str] = mapped_column(String(24), primary_key=True)  # PAY-1051-2: booking PP-1051's second; PAY-SUB-101-1 for a membership
    customer_id: Mapped[str] = mapped_column(ForeignKey("customers.id"), index=True)
    booking_id: Mapped[str | None] = mapped_column(ForeignKey("bookings.id"), index=True)
    subscription_id: Mapped[str | None] = mapped_column(ForeignKey("subscriptions.id"), index=True)
    # Bookings: advance (before the visit; it confirms the booking) · balance (the rest).
    # Memberships: plan (a period's price) · upgrade (the difference when moving up). refund: money given back (subtracted).
    kind: Mapped[str] = mapped_column(String(10))
    amount_paise: Mapped[int]
    method: Mapped[str] = mapped_column(String(8))
    at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=_utc_now)
    by: Mapped[str | None] = mapped_column(String(80))  # staff who took or refunded it at the shop
    # For a refund: the payment it gives back. unique=True: the database refuses a second refund of the same payment.
    refund_of: Mapped[str | None] = mapped_column(ForeignKey("payments.id"), unique=True)


class PaymentLink(Base):
    """A payment link sent on WhatsApp. At most one is open per booking or membership; a paid, replaced or unneeded link is closed."""

    __tablename__ = "payment_links"
    __table_args__ = (CheckConstraint("amount_type in ('hold', 'full')", name="link_amount_type_known"),)

    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=lambda: str(uuid4()))
    customer_id: Mapped[str] = mapped_column(ForeignKey("customers.id"), index=True)
    booking_id: Mapped[str | None] = mapped_column(ForeignKey("bookings.id"), index=True)
    subscription_id: Mapped[str | None] = mapped_column(ForeignKey("subscriptions.id"), index=True)
    amount_type: Mapped[str] = mapped_column(String(4))  # hold = the advance, full = everything still due
    amount_paise: Mapped[int]
    url: Mapped[str] = mapped_column(Text)
    sent_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=_utc_now)
    expires_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True))
    failed: Mapped[bool] = mapped_column(Boolean, default=False)  # the customer's bank declined it
    closed_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True))  # paid, replaced or not needed any more
