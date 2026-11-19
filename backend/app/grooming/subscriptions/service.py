"""Memberships (Subscriptions, and the plan card on a customer): renewal links, plan changes, renewing a period, and what a
member gets on a bill (root CLAUDE.md › Booking & payment rules › Plan changes).

Not here yet: joining a plan (customers do that in the app, Module 11) and the daily check that ends unpaid memberships
(with the payment gateway, Module 12).
"""

import datetime as dt

from fastapi import HTTPException
from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.core.config import settings
from app.core.dates import add_months, short_date, today
from app.core.money import inr
from app.core.schemas import Paged
from app.grooming.plans.models import Plan
from app.grooming.plans.service import list_plans
from app.grooming.subscriptions.models import SUBSCRIPTION_NUMBER, PlanChange, Subscription
from app.grooming.subscriptions.schemas import (
    AppMembershipOut, NextPlan, PlanChangeIn, PlanChangeOut, PlanCount, PlanLinkOut, PlanOption, SubscriptionCustomer, SubscriptionOut,
    SubscriptionSummary,
)
from app.shared.customers.schemas import CustomerPlan
from app.shared.payments.models import Payment, PaymentLink
from app.shared.payments.service import METHOD_LABELS, open_link
from app.shared.settings.service import get_section

RENEWING_DAYS = 7
RUNNING = ("active", "payment_pending")
MONTHS = {"month": 1, "quarter": 3, "year": 12}
TABS = ("all", "active", "renewing", "pending", "ended")
WITH_DETAILS = (selectinload(Subscription.customer), selectinload(Subscription.plan), selectinload(Subscription.next_plan),
                selectinload(Subscription.changes), selectinload(Subscription.links))
ENDED = "This plan has ended. Start a new subscription instead."


def _utc_now() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


# ── Reading ──


def subscription_out(s: Subscription) -> SubscriptionOut:
    link = open_link(s.links)
    renews_onto = s.next_plan or s.plan  # a waiting downgrade is what they renew onto
    return SubscriptionOut(
        id=s.id, customer=SubscriptionCustomer.model_validate(s.customer), plan_id=s.plan_id, plan_name=s.plan_name, price_paise=s.price_paise,
        sessions_total=s.sessions_total, sessions_used=s.sessions_used, started_on=s.started_on, renews_on=s.renews_on, ended_on=s.ended_on,
        status=s.status, changes=[PlanChangeOut.model_validate(c) for c in s.changes],
        payment_link=PlanLinkOut(link=link.url, sent_at=link.sent_at, amount_paise=link.amount_paise, plan_name=renews_onto.name) if link else None,
        next_plan=NextPlan(plan_id=s.next_plan.id, plan_name=s.next_plan.name, price_paise=s.next_plan.price_paise) if s.next_plan else None,
    )


def find_subscription(db: Session, subscription_id: str) -> Subscription:
    s = db.get(Subscription, subscription_id)
    if not s:
        raise HTTPException(status_code=404, detail="Subscription not found.")
    return s


def _renewing(s: Subscription) -> bool:
    return s.status == "active" and s.renews_on is not None and s.renews_on <= today() + dt.timedelta(days=RENEWING_DAYS)


def _in_tab(s: Subscription, tab: str) -> bool:
    return {
        "active": s.status == "active", "renewing": _renewing(s), "pending": s.status == "payment_pending",
        "ended": s.status in ("expired", "cancelled"),
    }.get(tab, True)


def list_subscriptions(db: Session, tab: str, page: int, page_size: int) -> Paged[SubscriptionOut]:
    """Things to act on first: renewing soon, then waiting for the first payment, then the rest by renewal date."""
    def rank(s: Subscription):
        return (0 if _renewing(s) else 1 if s.status == "payment_pending" else 2 if s.status == "active" else 3, s.renews_on or s.ended_on or dt.date.max)

    rows = sorted((s for s in db.scalars(select(Subscription).options(*WITH_DETAILS)) if _in_tab(s, tab)), key=rank)
    return Paged(items=[subscription_out(s) for s in rows[(page - 1) * page_size:page * page_size]], total=len(rows), page=page, page_size=page_size)


def summary(db: Session) -> SubscriptionSummary:
    subs = list(db.scalars(select(Subscription).options(selectinload(Subscription.links))))
    active = [s for s in subs if s.status == "active"]
    month_start = today().replace(day=1)
    ended = [s for s in subs if s.ended_on and s.ended_on >= month_start]
    return SubscriptionSummary(
        active=len(active),
        by_plan=[PlanCount(name=p.name, count=sum(s.plan_id == p.id for s in active)) for p in list_plans(db)],
        monthly_paise=sum(s.price_paise for s in active),
        renewing_soon=sum(map(_renewing, subs)),
        need_link=sum(_renewing(s) and not open_link(s.links) for s in subs),
        ended_this_month=len(ended),
        expired_this_month=sum(s.status == "expired" for s in ended),
        cancelled_this_month=sum(s.status == "cancelled" for s in ended),
        counts={tab: sum(_in_tab(s, tab) for s in subs) for tab in TABS},
    )


# ── What a member gets on a bill ──


def active_membership(db: Session, customer_id: str) -> Subscription | None:
    return db.scalar(select(Subscription).where(Subscription.customer_id == customer_id, Subscription.status == "active"))


def sessions_left(s: Subscription) -> int | None:
    return None if s.sessions_total is None else max(0, s.sessions_total - s.sessions_used)


def customer_plan(s: Subscription | None) -> CustomerPlan | None:
    if not s:
        return None
    return CustomerPlan(
        subscription_id=s.id, name=s.plan.name, discount_percent=s.plan.discount_percent, price_paise=s.price_paise,
        sessions_left=sessions_left(s), sessions_total=s.sessions_total, eligible_service_ids=s.plan.eligible_service_ids,
        renews_on=s.renews_on, next_plan_name=s.next_plan.name if s.next_plan else None,
    )


def use_session(db: Session, customer_id: str, give_back: bool = False) -> None:
    """A confirmed booking paid by a plan session uses one; cancelling gives it back (a no-show keeps it used).
    The database does the counting, so two bookings at once both count."""
    change = func.greatest(Subscription.sessions_used - 1, 0) if give_back else Subscription.sessions_used + 1
    db.execute(update(Subscription).where(Subscription.customer_id == customer_id, Subscription.status == "active",
                                          Subscription.sessions_total.is_not(None)).values(sessions_used=change))


# ── Links and renewals ──


def payment_link(db: Session, s: Subscription) -> SubscriptionOut:
    """A renewal link for an active plan, or the first-payment link for a pending one. It charges today's price of the plan
    they renew onto (price changes reach members at renewal)."""
    if s.status not in RUNNING:
        raise HTTPException(status_code=409, detail=ENDED)
    sent = _utc_now()
    if link := open_link(s.links):
        link.closed_at = sent  # replaced
    onto = s.next_plan or s.plan
    s.links.append(PaymentLink(customer_id=s.customer_id, amount_type="full", amount_paise=onto.price_paise, sent_at=sent,
                               url=f"https://pay.poshpaws.in/s/{s.id}-{int(sent.timestamp()):x}",  # a demo address until Module 12
                               expires_at=sent + dt.timedelta(hours=get_section(db, "payments").link_expiry_hours)))
    db.commit()
    return subscription_out(s)


def pay_link(db: Session, s: Subscription) -> SubscriptionOut:
    """The open link is paid: the first period starts, or the next one does (a waiting downgrade starts now, sessions start
    again, the price becomes the plan's). Until the payment gateway is connected (Module 12) the demo route calls this."""
    if settings.production or get_section(db, "payments").provider:  # a stand-in for your Mac only
        raise HTTPException(status_code=409, detail="Online payments come from the payment gateway.")
    link = open_link(s.links)
    if not link:
        raise HTTPException(status_code=409, detail="There's no open payment link.")
    link.closed_at = _utc_now()
    plan = s.next_plan or s.plan
    s.payments.append(Payment(id=f"PAY-{s.id}-{len(s.payments) + 1}", customer_id=s.customer_id, kind="plan", amount_paise=link.amount_paise,
                              method="online"))
    period_starts = today() if s.status == "payment_pending" or not s.renews_on else s.renews_on
    s.status, s.plan_id, s.plan_name, s.price_paise = "active", plan.id, plan.name, plan.price_paise
    s.plan, s.next_plan_id, s.next_plan = plan, None, None
    s.sessions_total, s.sessions_used = plan.sessions_per_period, 0
    s.renews_on = add_months(period_starts, MONTHS[plan.billing])
    db.commit()
    return subscription_out(s)


# ── Plan changes ──


def _option(s: Subscription, plan: Plan) -> PlanOption:
    base = {"plan_id": plan.id, "name": plan.name, "price_paise": plan.price_paise, "sessions_per_period": plan.sessions_per_period,
            "discount_percent": plan.discount_percent}
    if plan.id == s.plan_id:
        return PlanOption(**base, change="current", pay_now_paise=0, starts_on=today(), sessions_left=sessions_left(s))
    if s.status == "payment_pending":
        return PlanOption(**base, change="switch", pay_now_paise=0, starts_on=today(), sessions_left=plan.sessions_per_period)
    if plan.price_paise > s.price_paise:
        # An upgrade starts now: pay the difference for this period, keep the sessions already used and the renewal date.
        left = None if plan.sessions_per_period is None else max(0, plan.sessions_per_period - s.sessions_used)
        return PlanOption(**base, change="upgrade", pay_now_paise=plan.price_paise - s.price_paise, starts_on=today(), sessions_left=left)
    return PlanOption(**base, change="downgrade", pay_now_paise=0, starts_on=s.renews_on or today(), sessions_left=sessions_left(s))


def plan_options(db: Session, s: Subscription) -> list[PlanOption]:
    if s.status not in RUNNING:
        raise HTTPException(status_code=409, detail=ENDED)
    return [_option(s, p) for p in list_plans(db)]


def change_plan(db: Session, s: Subscription, body: PlanChangeIn, by: str) -> SubscriptionOut:
    option = next((o for o in plan_options(db, s) if o.plan_id == body.plan_id), None)
    plan = db.get(Plan, body.plan_id)
    if not option or not plan:
        raise HTTPException(status_code=400, detail="Pick a plan.")
    if option.change == "current" and not s.next_plan_id:
        raise HTTPException(status_code=400, detail=f"They're already on the {plan.name} plan.")
    if option.change == "upgrade" and not body.method:
        raise HTTPException(status_code=400, detail=f"Choose how they paid the {inr(option.pay_now_paise)} difference.")

    change = PlanChange(kind="keep" if option.change == "current" else option.change, from_plan=s.plan_name, to_plan=plan.name, by=by)
    if option.change == "downgrade":
        s.next_plan_id, s.next_plan = plan.id, plan
    elif option.change == "current":
        change.to_plan = s.next_plan.name
        s.next_plan_id, s.next_plan = None, None
    else:
        # Upgrade or switch: the new plan starts now. Sessions already used this period still count.
        s.plan_id, s.plan, s.plan_name, s.price_paise = plan.id, plan, plan.name, plan.price_paise
        s.sessions_total, s.next_plan_id, s.next_plan = plan.sessions_per_period, None, None
    if option.change == "upgrade":
        change.paid_paise, change.method = option.pay_now_paise, body.method
        s.payments.append(Payment(id=f"PAY-{s.id}-{len(s.payments) + 1}", customer_id=s.customer_id, kind="upgrade",
                                  amount_paise=option.pay_now_paise, method=body.method, by=by))
    if link := open_link(s.links):
        link.closed_at = _utc_now()  # it charged the old plan; staff send a new one
    s.changes.insert(0, change)
    db.commit()
    return subscription_out(s)


def change_text(c: PlanChange, renews_on: dt.date | None) -> tuple[str, str]:
    """One line (title, detail) for activity lists."""
    if c.kind == "upgrade":
        return f"Upgraded from {c.from_plan} to {c.to_plan}", f"{inr(c.paid_paise)} difference by {METHOD_LABELS[c.method]}"
    if c.kind == "downgrade":
        return f"Moving from {c.from_plan} to {c.to_plan}", f"At renewal{f' on {short_date(renews_on)}' if renews_on else ''}"
    if c.kind == "switch":
        return f"Plan changed from {c.from_plan} to {c.to_plan}", "Before the first payment"
    return f"Staying on {c.from_plan}", f"The move to {c.to_plan} was called off"


# ── The customer app: a customer's own membership ──


def _app_membership(s: Subscription) -> AppMembershipOut:
    return AppMembershipOut(
        plan_id=s.plan_id, plan_name=s.plan_name, price_paise=s.price_paise, status=s.status, sessions_total=s.sessions_total,
        sessions_used=s.sessions_used, sessions_left=sessions_left(s), discount_percent=s.plan.discount_percent, renews_on=s.renews_on,
        next_plan_name=s.next_plan.name if s.next_plan else None,
    )


def _running(db: Session, customer_id: str) -> Subscription | None:
    return db.scalar(select(Subscription).where(Subscription.customer_id == customer_id, Subscription.status.in_(RUNNING))
                     .options(selectinload(Subscription.plan), selectinload(Subscription.next_plan)))


def my_membership(db: Session, customer_id: str) -> AppMembershipOut | None:
    s = _running(db, customer_id)
    return _app_membership(s) if s else None


def join_in_app(db: Session, customer_id: str, plan_id: str) -> AppMembershipOut:
    """The app takes the first period's payment (a stand-in until the payment gateway, Module 12), so the plan starts now.
    Online joining is closed in production until then. Changing plans is done by staff."""
    if settings.production and not get_section(db, "payments").provider:
        raise HTTPException(status_code=503, detail="Joining online opens soon. Please call us to join.")
    plan = db.get(Plan, plan_id)
    if not plan or not plan.subscribable:
        raise HTTPException(status_code=404, detail="Plan not found.")
    already = HTTPException(status_code=409, detail="You're on a plan already. To change it, call us and we'll switch it for you.")
    if current := _running(db, customer_id):
        already.detail = f"You're on the {current.plan_name} plan. To change it, call us and we'll switch it for you."
        raise already
    number = db.scalar(select(SUBSCRIPTION_NUMBER.next_value()))
    t = today()
    s = Subscription(id=f"SUB-{number}", customer_id=customer_id, plan_id=plan.id, plan=plan, plan_name=plan.name, price_paise=plan.price_paise,
                     sessions_total=plan.sessions_per_period, sessions_used=0, started_on=t, renews_on=add_months(t, MONTHS[plan.billing]),
                     status="active")
    s.payments.append(Payment(id=f"PAY-{s.id}-1", customer_id=customer_id, kind="plan", amount_paise=plan.price_paise, method="online"))
    db.add(s)
    try:
        db.commit()
    except IntegrityError as e:  # joined twice at the same moment: the database keeps one running membership
        db.rollback()
        raise already from e
    return _app_membership(s)
