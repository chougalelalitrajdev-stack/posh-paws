"""The bookings table and each booking's activity log."""

import datetime as dt

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, Sequence, String, Text
from sqlalchemy.dialects.postgresql import TSRANGE, ExcludeConstraint, Range
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.shared.customers.models import Customer, Pet
from app.shared.payments.models import Payment, PaymentLink

# Booking numbers (PP-1001, PP-1002, ...) come from a database counter, so two bookings made at once never get the same one.
BOOKING_NUMBER = Sequence("booking_number", start=1001, metadata=Base.metadata)

STAGES = ("draft", "awaiting_payment", "confirmed", "completed", "cancelled", "no_show")
HOLDS_SLOT = ("awaiting_payment", "confirmed", "completed")  # stages that keep a station busy


def _utc_now() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


class Booking(Base):
    """One booking, from a draft (staff on a phone call) or an app booking to a finished groom.

    Customer and pet are read from their records (always current). The service is kept as it was booked:
    its name, length and price don't change if the service is edited later.
    """

    __tablename__ = "bookings"
    __table_args__ = (
        CheckConstraint(f"stage in {STAGES}", name="booking_stage_known"),
        CheckConstraint("source in ('app', 'phone', 'walk_in')", name="booking_source_known"),
        # The last line of defence against double booking: the database refuses two bookings whose `held` times overlap
        # on the same station, even if two people press Confirm at the same moment. (Needs PostgreSQL's btree_gist.)
        ExcludeConstraint(("station_id", "="), ("held", "&&"), using="gist", name="no_double_booking"),
    )

    id: Mapped[str] = mapped_column(String(12), primary_key=True)  # PP-1051
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=_utc_now)
    source: Mapped[str] = mapped_column(String(8), default="phone")
    stage: Mapped[str] = mapped_column(String(16), default="draft", index=True)
    # Worked out from the bill and the money (unpaid, paid, ...) and stored, so lists can filter on it.
    payment_status: Mapped[str] = mapped_column(String(10), default="unpaid")
    booked_by: Mapped[str | None] = mapped_column(String(80))  # staff name, for phone bookings

    customer_id: Mapped[str] = mapped_column(ForeignKey("customers.id"), index=True)
    pet_id: Mapped[str | None] = mapped_column(ForeignKey("pets.id"))
    service_id: Mapped[str | None] = mapped_column(ForeignKey("services.id"))
    service_name: Mapped[str | None] = mapped_column(String(80))
    duration_minutes: Mapped[int | None]

    date: Mapped[dt.date | None] = mapped_column(Date, index=True)
    time: Mapped[str | None] = mapped_column(String(5))  # HH:mm
    # SET NULL: removing a station keeps its old bookings (they just lose the station).
    station_id: Mapped[str | None] = mapped_column(ForeignKey("stations.id", ondelete="SET NULL"))
    # The station's time this booking holds, cleaning buffer included, as a time range ([10:00, 11:00)).
    # Empty while it doesn't hold a slot (a draft, cancelled, no-show).
    held: Mapped[Range[dt.datetime] | None] = mapped_column(TSRANGE)

    # The bill, worked out when the details are saved and fixed when the booking is confirmed. Money is paise.
    price_paise: Mapped[int | None]
    discount_kind: Mapped[str | None] = mapped_column(String(10))  # session | membership | offer
    discount_label: Mapped[str | None] = mapped_column(String(120))
    discount_paise: Mapped[int] = mapped_column(default=0)
    offer_id: Mapped[str | None] = mapped_column(ForeignKey("offers.id"))
    total_paise: Mapped[int | None]
    advance_paise: Mapped[int] = mapped_column(default=0)  # asked for online when booked in the app
    offer_code: Mapped[str | None] = mapped_column(String(20))  # the code the customer gave, if any

    customer: Mapped[Customer] = relationship()
    pet: Mapped[Pet | None] = relationship()
    activity: Mapped[list["BookingActivity"]] = relationship(order_by="BookingActivity.id.desc()")
    payments: Mapped[list[Payment]] = relationship(order_by=Payment.at)  # rows of the payments table for this booking
    links: Mapped[list[PaymentLink]] = relationship(order_by=PaymentLink.sent_at)  # every link sent; at most one still open


class BookingActivity(Base):
    """One line of a booking's history ("Booking confirmed", "Rescheduled", a note)."""

    __tablename__ = "booking_activity"
    __table_args__ = (CheckConstraint("kind in ('created', 'details', 'payment', 'status', 'note')", name="activity_kind_known"),)

    id: Mapped[int] = mapped_column(primary_key=True)  # 1, 2, 3, ... given by the database
    booking_id: Mapped[str] = mapped_column(ForeignKey("bookings.id"), index=True)
    at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=_utc_now)
    kind: Mapped[str] = mapped_column(String(10))
    title: Mapped[str] = mapped_column(String(120))
    detail: Mapped[str | None] = mapped_column(Text)
    by: Mapped[str | None] = mapped_column(String(80))
