"""Membership shapes (admin: core/models/subscription.model.ts and CustomerPlan in customer.model.ts)."""

import datetime as dt
from typing import Literal

from pydantic import field_validator

from app.core.schemas import CamelModel

Status = Literal["active", "payment_pending", "expired", "cancelled"]
ChangeKind = Literal["upgrade", "downgrade", "switch", "keep"]
ShopMethod = Literal["upi_qr", "cash", "card"]


class SubscriptionCustomer(CamelModel):
    id: str
    name: str
    phone: str


class PlanLinkOut(CamelModel):
    """The open renewal or first-payment link: it charges amountPaise for planName."""

    link: str
    sent_at: dt.datetime
    amount_paise: int
    plan_name: str


class NextPlan(CamelModel):
    plan_id: str
    plan_name: str
    price_paise: int


class PlanChangeOut(CamelModel):
    at: dt.datetime
    kind: ChangeKind
    from_plan: str
    to_plan: str
    paid_paise: int
    method: ShopMethod | None
    by: str


class SubscriptionOut(CamelModel):
    id: str
    customer: SubscriptionCustomer
    plan_id: str
    plan_name: str
    price_paise: int
    sessions_total: int | None
    sessions_used: int
    started_on: dt.date
    renews_on: dt.date | None
    ended_on: dt.date | None
    status: Status
    payment_link: PlanLinkOut | None
    next_plan: NextPlan | None
    changes: list[PlanChangeOut]  # newest first


class PlanOption(CamelModel):
    """What moving to a plan would mean (GET /admin/subscriptions/{id}/plan-options)."""

    plan_id: str
    name: str
    price_paise: int
    sessions_per_period: int | None
    discount_percent: int
    change: ChangeKind | Literal["current"]  # current: their plan now (choosing it calls off a waiting downgrade)
    pay_now_paise: int  # an upgrade's difference for this period, else 0
    starts_on: dt.date
    sessions_left: int | None  # this period, after the change; None = unlimited


class PlanChangeIn(CamelModel):
    """POST /admin/subscriptions/{id}/change-plan. `method` is needed when an upgrade has a difference to pay."""

    plan_id: str
    method: ShopMethod | None = None

    @field_validator("method", mode="before")
    @classmethod
    def method_known(cls, v):
        return v if v in ("upi_qr", "cash", "card") else None


class PlanCount(CamelModel):
    name: str
    count: int


class SubscriptionSummary(CamelModel):
    active: int
    by_plan: list[PlanCount]
    monthly_paise: int
    renewing_soon: int  # active and renewing within 7 days
    need_link: int  # renewing soon with no link sent yet
    ended_this_month: int
    expired_this_month: int
    cancelled_this_month: int
    counts: dict[str, int]  # per tab: all, active, renewing, pending, ended


# ── The customer app (customer app: core/models/membership.model.ts) ──


class AppMembershipOut(CamelModel):
    """GET /subscriptions/current: the customer's own plan (staff change plans in the admin)."""

    plan_id: str
    plan_name: str
    price_paise: int
    status: Literal["active", "payment_pending"]
    sessions_total: int | None
    sessions_used: int
    sessions_left: int | None
    discount_percent: int
    renews_on: dt.date | None
    next_plan_name: str | None  # a move at renewal


class AppJoinIn(CamelModel):
    plan_id: str
