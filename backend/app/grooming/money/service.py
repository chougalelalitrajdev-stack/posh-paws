"""Payments (Business › Payments): every payment and refund, the links waiting to be paid and the balances still due,
worked out from bookings and memberships. Refunds (of booking payments) are Super Admin only."""

import datetime as dt

from fastapi import HTTPException
from sqlalchemy import and_, case, func, or_, select, true
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.dates import shop_date, starts_at
from app.core.money import inr
from app.core.schemas import Paged
from app.grooming.bookings.models import Booking
from app.grooming.bookings.service import WITH_DETAILS, add_payment, balance, find_booking, log, settle
from app.grooming.money.schemas import PaymentCustomer, PaymentRow, PaymentSummary
from app.grooming.subscriptions.models import Subscription
from app.grooming.subscriptions.service import MONTHS, WITH_DETAILS as SUBSCRIPTION_DETAILS
from app.shared.payments.models import Payment, PaymentLink
from app.shared.payments.service import KIND_LABELS, METHOD_LABELS, link_state, open_link, refunded_ids

TABS = {"all": (), "due": ("due",), "waiting": ("link_sent", "expired"), "paid": ("paid",), "failed": ("failed",), "refunded": ("refunded",)}
OPEN = ("due", "link_sent")  # money still open shows whatever the period


def booking_rows(b: Booking) -> list[PaymentRow]:
    """A booking's rows: each payment and refund, plus its open link or else the balance still due."""
    base = {"kind": "booking", "reference": b.id, "item": b.service_name or "Booking", "customer": PaymentCustomer(id=b.customer.id, name=b.customer.name)}
    gone = refunded_ids(b.payments)
    rows = [
        PaymentRow(**base, id=p.id, amount_paise=p.amount_paise, at=p.at, detail=f"{KIND_LABELS[p.kind]} · {METHOD_LABELS[p.method]}",
                   status="refunded" if p.kind == "refund" else "paid", refundable=p.kind != "refund" and p.id not in gone)
        for p in b.payments
    ]
    if link := open_link(b.links):
        rows.append(PaymentRow(**base, id=f"{b.id}-LINK", amount_paise=link.amount_paise, at=link.sent_at, status=link_state(link), refundable=False,
                               detail=f"Payment link · {'advance' if link.amount_type == 'hold' else 'full amount'}"))
    elif b.stage in ("confirmed", "completed") and (due := balance(b)):
        rows.append(PaymentRow(**base, id=f"{b.id}-DUE", amount_paise=due, at=starts_at(b.date, b.time) if b.date and b.time else b.created_at,
                               detail="Balance · after the visit" if b.stage == "completed" else "Balance · at the visit", status="due", refundable=False))
    return rows


def plan_rows(s: Subscription) -> list[PaymentRow]:
    """A membership's rows: each period paid, each upgrade difference, and the open renewal or first-payment link."""
    base = {"kind": "plan", "customer": PaymentCustomer(id=s.customer.id, name=s.customer.name), "refundable": False}
    period = MONTHS[s.plan.billing] * 31
    paid = [p for p in s.payments if p.kind == "plan"]
    rows = [
        PaymentRow(**base, id=p.id, reference=f"{s.plan_name} plan · {p.at:%b}", detail="Plan · Online" if p.method == "online" else f"Plan · {METHOD_LABELS[p.method]}",
                   item="First month" if i == 0 and (shop_date(p.at) - s.started_on).days < period else "Plan renewal",
                   amount_paise=p.amount_paise, status="paid", at=p.at)
        for i, p in enumerate(paid)
    ]
    upgrades = [c for c in reversed(s.changes) if c.kind == "upgrade"]  # oldest first, like the payments
    for p, c in zip([p for p in s.payments if p.kind == "upgrade"], upgrades):
        rows.append(PaymentRow(**base, id=p.id, reference=f"{c.to_plan} plan", item=f"Upgrade from {c.from_plan}",
                               detail=f"Difference · {METHOD_LABELS[p.method]}", amount_paise=p.amount_paise, status="paid", at=p.at))
    if link := open_link(s.links):
        rows.append(PaymentRow(**base, id=f"{s.id}-LINK", reference=f"{(s.next_plan or s.plan).name} plan", detail="Payment link",
                               item="First month" if s.status == "payment_pending" else "Plan renewal",
                               amount_paise=link.amount_paise, status=link_state(link), at=link.sent_at))
    return rows


def payment_rows(db: Session, start: dt.date | None = None, end: dt.date | None = None, customer_id: str | None = None) -> list[PaymentRow]:
    """Every row in the period (from `start` to `end`, the shop's days, both included), newest first; open money whatever the period."""
    lo = starts_at(start, "00:00") if start else None
    hi = starts_at(end + dt.timedelta(days=1), "00:00") if end else None
    in_period = [c for c in (Payment.at >= lo if lo else None, Payment.at < hi if hi else None) if c is not None]
    paid_so_far = (
        select(func.coalesce(func.sum(case((Payment.kind == "refund", -Payment.amount_paise), else_=Payment.amount_paise)), 0))
        .where(Payment.booking_id == Booking.id).scalar_subquery()
    )
    # Only bookings with something to show: a payment in the period, an open link, or a balance still due.
    query = select(Booking).where(or_(
        Booking.payments.any(and_(true(), *in_period)),
        Booking.links.any(PaymentLink.closed_at.is_(None)),
        and_(Booking.stage.in_(("confirmed", "completed")), Booking.total_paise > paid_so_far),
    )).options(*WITH_DETAILS)
    memberships = select(Subscription).where(or_(
        Subscription.payments.any(and_(true(), *in_period)),
        Subscription.links.any(PaymentLink.closed_at.is_(None)),
    )).options(*SUBSCRIPTION_DETAILS)
    if customer_id:
        query = query.where(Booking.customer_id == customer_id)
        memberships = memberships.where(Subscription.customer_id == customer_id)
    rows = [r for b in db.scalars(query) for r in booking_rows(b)] + [r for s in db.scalars(memberships) for r in plan_rows(s)]
    rows = [r for r in rows if r.status in OPEN or ((not lo or r.at >= lo) and (not hi or r.at < hi))]
    return sorted(rows, key=lambda r: r.at, reverse=True)


def list_payments(db: Session, tab: str, start: dt.date | None, end: dt.date | None, page: int, page_size: int) -> Paged[PaymentRow]:
    states = TABS[tab]
    rows = [r for r in payment_rows(db, start, end) if not states or r.status in states]
    return Paged(items=rows[(page - 1) * page_size:page * page_size], total=len(rows), page=page, page_size=page_size)


def summary(db: Session, start: dt.date | None, end: dt.date | None) -> PaymentSummary:
    rows = payment_rows(db, start, end)

    def of(state: str) -> list[PaymentRow]:
        return [r for r in rows if r.status == state]

    return PaymentSummary(
        collected_paise=sum(r.amount_paise for r in of("paid")), collected_count=len(of("paid")),
        waiting_paise=sum(r.amount_paise for r in of("link_sent")), waiting_count=len(of("link_sent")),
        due_paise=sum(r.amount_paise for r in of("due")), due_count=len(of("due")),
        failed_count=len(of("failed")),
        refunded_paise=sum(r.amount_paise for r in of("refunded")), refunded_count=len(of("refunded")),
    )


def refund(db: Session, payment_id: str, by: str) -> PaymentRow:
    """Gives one booking payment back in full, the way it came in. The booking stays as it is (cancel it separately if needed).
    Until the payment gateway is connected (Module 12), this records the refund; the money itself goes back by hand."""
    entry = db.get(Payment, payment_id)
    if not entry or entry.kind == "refund" or not entry.booking_id:
        raise HTTPException(status_code=404, detail="Payment not found, or it can't be refunded here.")
    b = find_booking(db, entry.booking_id)
    already = HTTPException(status_code=409, detail="This payment has already been refunded.")
    if entry.id in refunded_ids(b.payments):
        raise already
    back = add_payment(b, "refund", entry.amount_paise, entry.method, by, refund_of=entry.id)
    log(b, "payment", "Payment refunded", f"{inr(entry.amount_paise)} · {METHOD_LABELS[entry.method]}", by)
    settle(b)
    try:
        db.commit()
    except IntegrityError as e:  # two refunds of the same payment at once: the database keeps only one
        db.rollback()
        raise already from e
    return next(r for r in booking_rows(b) if r.id == back.id)
