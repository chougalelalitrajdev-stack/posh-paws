"""Settings sections, holidays and the usual week. Each section is checked here before it's saved, with the admin's messages."""

import datetime as dt
import re
from typing import Literal

from pydantic import field_validator, model_validator

from app.core.dates import TIME, minutes_of_day, time_from_minutes
from app.core.schemas import CamelModel

DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


def _between(value: int, low: int, high: int, message: str) -> int:
    if not low <= value <= high:
        raise ValueError(message)
    return value


def _times(values: list[str] | None) -> list[str] | None:
    """A sorted list of distinct HH:mm times (weekly closed or extra start times)."""
    if values is None:
        return None
    if any(not TIME.match(v) for v in values):
        raise ValueError("Start times look like 09:30.")
    return sorted(set(values))


# ── Business ──


class BusinessSettings(CamelModel):
    """Shown in the customer app's footer and on its Call and WhatsApp buttons."""

    name: str
    phone: str = ""
    whatsapp: str = ""
    email: str = ""
    instagram: str = ""
    maps_link: str = ""
    address: str = ""

    @field_validator("*", mode="before")
    @classmethod
    def trimmed(cls, v):
        return v.strip() if isinstance(v, str) else ("" if v is None else v)

    @field_validator("name")
    @classmethod
    def name_given(cls, v: str) -> str:
        if not v:
            raise ValueError("Enter the business name.")
        return v

    @field_validator("email")
    @classmethod
    def email_looks_right(cls, v: str) -> str:
        if v and not re.match(r"^\S+@\S+\.\S+$", v):
            raise ValueError("That email doesn't look right.")
        return v


# ── Booking rules ──


class DayHours(CamelModel):
    """One weekday (0 = Monday): open or not, its hours and break, and start times closed or added every week."""

    day: int
    open: bool
    opens: str
    closes: str
    break_from: str | None = None
    break_to: str | None = None
    # None when saving = keep what's there (they're changed on Availability › Week, one start time at a time).
    closed_starts: list[str] | None = None
    extra_starts: list[str] | None = None

    @field_validator("closed_starts", "extra_starts")
    @classmethod
    def valid_times(cls, v: list[str] | None) -> list[str] | None:
        return _times(v)


class BookingRules(CamelModel):
    """Availability › Week: hours for the seven days and the slot rules. The slot engine offers start times by these."""

    hours: list[DayHours]
    slot_step_minutes: int
    buffer_minutes: int
    book_ahead_days: int
    min_notice_minutes: int

    @model_validator(mode="after")
    def check(self) -> "BookingRules":
        if len(self.hours) != 7:
            raise ValueError("Send hours for all seven days.")
        for i, h in enumerate(self.hours):
            h.day, name = i, DAY_NAMES[i]
            if not h.open:
                h.break_from = h.break_to = None
                continue
            if not TIME.match(h.opens) or not TIME.match(h.closes) or h.opens >= h.closes:
                raise ValueError(f"{name}: closing time must be after opening time.")
            if h.break_from or h.break_to:
                ok = all(TIME.match(t or "") for t in (h.break_from, h.break_to))
                if not ok or not h.opens < h.break_from < h.break_to < h.closes:
                    raise ValueError(f"{name}: the break must be inside opening hours.")
            else:
                h.break_from = h.break_to = None
        if not any(h.open for h in self.hours):
            raise ValueError("Open at least one day a week.")
        _between(self.slot_step_minutes, 5, 120, "Pick how often slots start.")
        _between(self.buffer_minutes, 0, 60, "Pick a buffer of 0 to 60 minutes.")
        _between(self.book_ahead_days, 1, 365, "Pick how far ahead bookings can be made.")
        _between(self.min_notice_minutes, 0, 2880, "Pick the minimum notice.")
        return self


# ── Payments, notifications, customer app ──


class PaymentSettings(CamelModel):
    currency: Literal["INR"] = "INR"
    link_expiry_hours: int
    # The advance for app bookings.
    slot_hold_paise: int
    # Cancelled at least this long before the slot: the advance is refunded.
    free_cancellation_hours: int
    # The shop's UPI ID and QR, for paying the balance at the shop.
    upi_id: str = ""
    qr_image_url: str | None = None
    # Set by the server once a payment gateway is connected; staff can't change it.
    provider: str | None = None

    @model_validator(mode="after")
    def check(self) -> "PaymentSettings":
        _between(self.link_expiry_hours, 1, 72, "Links can last 1 to 72 hours.")
        _between(self.slot_hold_paise, 100, 500_000, "Enter an advance in whole rupees.")
        _between(self.free_cancellation_hours, 0, 168, "Pick how long before the slot a cancellation still gets the advance back.")
        self.upi_id = self.upi_id.strip()
        if self.upi_id and not re.match(r"^[\w.-]{2,}@[\w.-]{2,}$", self.upi_id):
            raise ValueError("That UPI ID doesn't look right (it looks like name@bank).")
        self.qr_image_url = self.qr_image_url or None
        return self


class NotificationSettings(CamelModel):
    # Booking reminders go out at this time the day before (HH:mm).
    reminder_time: str
    # Follow up an unpaid link, and flag it on Today, after this many hours.
    unpaid_nudge_hours: int
    # Who hears when a customer books in the app.
    staff_alerts: Literal["admins", "everyone"]

    @model_validator(mode="after")
    def check(self) -> "NotificationSettings":
        if not TIME.match(self.reminder_time):
            raise ValueError("Pick a reminder time.")
        _between(self.unpaid_nudge_hours, 1, 48, "Pick when to follow up unpaid links.")
        return self


class AppSettings(CamelModel):
    book_button_text: str
    show_prices: bool

    @field_validator("book_button_text")
    @classmethod
    def short(cls, v: str) -> str:
        v = v.strip()
        if not 1 <= len(v) <= 20:
            raise ValueError("Keep the Book button text to 1–20 characters.")
        return v


# ── Holidays ──


class ClosureIn(CamelModel):
    date: dt.date | None = None
    name: str = ""
    # Closing early at this time; None = closed all day.
    closes_at: str | None = None

    @model_validator(mode="after")
    def check(self) -> "ClosureIn":
        self.name = self.name.strip()
        if not self.date:
            raise ValueError("Pick a date.")
        if not self.name:
            raise ValueError("Name the closure, e.g. Diwali.")
        if self.closes_at and not TIME.match(self.closes_at):
            raise ValueError("Pick the closing time.")
        self.closes_at = self.closes_at or None
        return self


class ClosureOut(CamelModel):
    id: str
    date: dt.date
    name: str
    closes_at: str | None
    # Bookings already on that day (after closes_at), so staff know what to move.
    affected_bookings: int = 0


# ── Everything at once (GET /admin/settings) ──


class BookingSettingsOut(BookingRules):
    closures: list[ClosureOut]


class SettingsOut(CamelModel):
    business: BusinessSettings
    booking: BookingSettingsOut
    payments: PaymentSettings
    notifications: NotificationSettings
    app: AppSettings


# ── The usual week's start times (Availability › Week) ──


class WeekSlot(CamelModel):
    time: str
    # break = inside the break, so not bookable unless opened every week as an extra time.
    state: Literal["open", "closed", "extra", "break"]


class WeekDay(DayHours):
    slots: list[WeekSlot]


class WeekBoardOut(CamelModel):
    step_minutes: int
    days: list[WeekDay]


class WeekSlotIn(CamelModel):
    time: str
    open: bool


def in_break(h: DayHours, time: str) -> bool:
    return bool(h.break_from and h.break_to and h.break_from <= time < h.break_to)


def starts_in(h: DayHours, duration: int, step: int) -> list[str]:
    """Every slot step inside these hours where a visit this long fits."""
    if not h.open:
        return []
    starts, t = [], minutes_of_day(h.opens)
    while t + duration <= minutes_of_day(h.closes):
        starts.append(time_from_minutes(t))
        t += step
    return starts


class ShopOut(CamelModel):
    """GET /shop: what the customer app needs to explain payments (and nothing else from Settings)."""

    advance_paise: int  # paid online to confirm an app booking
    free_cancellation_hours: int  # cancelled at least this long before: the advance is refunded
    upi_id: str
    qr_image_url: str | None
