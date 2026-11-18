"""Booking shapes: what the admin sends and what it gets back (admin: core/models/booking.model.ts)."""

import datetime as dt
from typing import Literal

from pydantic import ConfigDict, field_validator

from app.core.dates import TIME
from app.core.schemas import CamelModel
from app.grooming.catalog.schemas import StationOut
from app.grooming.slots.schemas import TimeBlockOut

Stage = Literal["draft", "awaiting_payment", "confirmed", "completed", "cancelled", "no_show"]
PaymentStatus = Literal["unpaid", "link_sent", "failed", "part_paid", "paid", "refunded"]


class BillDiscount(CamelModel):
    """The one discount on a bill (they don't stack; the best wins)."""

    kind: Literal["session", "membership", "offer"]
    label: str  # "Posh plan session", "Posh member 10% off", "DIWALI20 · Diwali grooming week"
    amount_paise: int
    offer_id: str | None = None


class BookingBill(CamelModel):
    """What the booking costs and what's been paid. Worked out here; both apps show it as is."""

    service_price_paise: int
    discount: BillDiscount | None
    total_paise: int
    advance_paise: int  # asked for online when booked in the app; 0 for phone bookings
    paid_paise: int = 0  # payments minus refunds
    balance_paise: int  # total − paid, never below 0


class PaymentEntry(CamelModel):
    """Money received for a booking, or given back. Amounts are positive; refunds are subtracted."""

    id: str  # PAY-1051-1
    kind: Literal["advance", "balance", "refund"]
    amount_paise: int
    method: Literal["online", "upi_qr", "cash", "card"]
    at: dt.datetime
    by: str | None = None
    refund_of: str | None = None


class PaymentLinkOut(CamelModel):
    """The open payment link, if any."""

    amount_type: Literal["hold", "full"]
    amount_paise: int
    url: str
    sent_at: dt.datetime
    expires_at: dt.datetime
    failed: bool


class ActivityEntry(CamelModel):
    at: dt.datetime
    kind: Literal["created", "details", "payment", "status", "note"]
    title: str
    detail: str | None = None
    by: str | None = None


class BookingCustomer(CamelModel):
    id: str
    name: str
    phone: str


class BookingPet(CamelModel):
    id: str
    name: str
    type: Literal["dog", "cat"]
    breed: str | None


class BookingService(CamelModel):
    id: str
    name: str
    duration_minutes: int


class BookingOut(CamelModel):
    id: str
    created_at: dt.datetime
    source: Literal["app", "phone", "walk_in"]
    stage: Stage
    payment_status: PaymentStatus
    customer: BookingCustomer
    pet: BookingPet | None
    service: BookingService | None
    date: dt.date | None
    time: str | None
    station_id: str | None
    bill: BookingBill | None
    payments: list[PaymentEntry] = []
    payment_link: PaymentLinkOut | None = None
    offer_code: str | None
    booked_by: str | None
    activity: list[ActivityEntry]


class BookingDetailsIn(CamelModel):
    """POST /admin/bookings (a new draft) and PUT /admin/bookings/{id} (a draft). The slot can be left for later."""

    model_config = ConfigDict(str_strip_whitespace=True)

    customer_id: str
    pet_id: str
    service_id: str
    date: dt.date | None = None
    time: str | None = None
    offer_code: str | None = None

    @field_validator("time")
    @classmethod
    def time_looks_right(cls, v: str | None) -> str | None:
        if v and not TIME.match(v):
            raise ValueError("Pick a time like 10:30.")
        return v or None

    @field_validator("offer_code")
    @classmethod
    def upper_code(cls, v: str | None) -> str | None:
        return v.upper() if v else None


class QuoteIn(CamelModel):
    """POST /admin/bookings/quote: the bill a booking would have, without saving anything."""

    model_config = ConfigDict(str_strip_whitespace=True)

    customer_id: str
    service_id: str
    offer_code: str | None = None


class RescheduleIn(CamelModel):
    date: dt.date
    time: str

    @field_validator("time")
    @classmethod
    def time_given(cls, v: str) -> str:
        if not TIME.match(v):
            raise ValueError("Pick a time like 10:30.")
        return v


class PaymentLinkIn(CamelModel):
    """POST /admin/bookings/{id}/payment-link: before the booking is confirmed, ask for the advance (hold) or the full amount."""

    amount_type: Literal["hold", "full"] = "full"


class ShopPaymentIn(CamelModel):
    """POST /admin/bookings/{id}/payments: money taken at the shop. complete = checkout (also marks the visit completed)."""

    amount_paise: int
    method: Literal["upi_qr", "cash", "card"]
    complete: bool = False

    @field_validator("amount_paise")
    @classmethod
    def amount_given(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("Enter the amount received.")
        return v

    @field_validator("method", mode="before")
    @classmethod
    def method_known(cls, v):
        if v not in ("upi_qr", "cash", "card"):
            raise ValueError("Pick how they paid: shop QR, cash or card.")
        return v


class CancelIn(CamelModel):
    reason: str = ""


class NoteIn(CamelModel):
    text: str = ""


class CalendarOut(CamelModel):
    """GET /admin/calendar?from=&days=: stations, the bookings holding them and the blocked time, for the calendar grid."""

    stations: list[StationOut]
    bookings: list[BookingOut]
    blocks: list[TimeBlockOut]
    opens: str  # earliest opening and latest closing in the week, HH:mm
    closes: str
