"""The Today screen in one reply (admin: core/models/dashboard.model.ts). This topic has no tables of its own."""

import datetime as dt
from typing import Literal

from app.core.schemas import CamelModel
from app.grooming.bookings.schemas import BookingOut


class AwaitingPayment(CamelModel):
    count: int
    outstanding_paise: int  # on the open links
    failed: int


class TodaySummary(CamelModel):
    count: int
    done: int
    next_time: str | None
    due_paise: int  # still to collect at the shop from today's appointments
    due_count: int


class AttentionItem(CamelModel):
    """Something that needs a person now, oldest first."""

    kind: Literal["visit", "failed", "unpaid", "draft", "content"]  # visit: over, but nobody said whether the pet came
    title: str
    detail: str
    at: dt.datetime
    link: str  # the admin page the button opens
    query_params: dict[str, str] | None = None
    action: str
    booking_id: str | None = None  # visit items: Today can close it in place
    balance_paise: int | None = None


class DayAmount(CamelModel):
    date: dt.date
    amount_paise: int


class WeekPayments(CamelModel):
    total_paise: int
    count: int
    failed: int
    refunds: int
    days: list[DayAmount]  # the last 7 days, oldest first


class PlanCount(CamelModel):
    name: str
    count: int


class Memberships(CamelModel):
    active: int
    renew_this_week: int
    expired: int  # this month
    plans: list[PlanCount]


class ContentRow(CamelModel):
    title: str
    where: str
    status: str
    tone: Literal["success", "warn", "draft"]


class DashboardOut(CamelModel):
    open_stations: int
    awaiting_payment: AwaitingPayment
    today: TodaySummary
    renewals_this_week: int
    attention: list[AttentionItem]
    schedule: list[BookingOut]  # today's appointments, by time
    payments: WeekPayments
    memberships: Memberships
    content: list[ContentRow]  # banners, gallery and pages
