"""Everything the Today screen shows, worked out from bookings, payments and memberships in a handful of queries.
Content reminders (banners ending soon) come with Module 8."""

import datetime as dt

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.dates import age_label, now, shop_date, short_date, starts_at, today
from app.core.money import inr
from app.grooming.bookings.models import HOLDS_SLOT, Booking
from app.grooming.bookings.service import WITH_DETAILS, balance, booking_out
from app.grooming.catalog.service import list_stations
from app.grooming.dashboard.schemas import AttentionItem, AwaitingPayment, DashboardOut, DayAmount, Memberships, PlanCount, TodaySummary, WeekPayments
from app.grooming.subscriptions.service import summary as membership_summary
from app.shared.payments.models import Payment
from app.shared.payments.service import open_link
from app.shared.settings.service import get_section


def attention(db: Session) -> list[AttentionItem]:
    """Visits nobody closed, failed and long-unpaid links, unfinished drafts: oldest first."""
    t, moment = today(), now()
    nudge = dt.timedelta(hours=get_section(db, "notifications").unpaid_nudge_hours)
    bookings = db.scalars(select(Booking).where(or_(
        Booking.stage.in_(("awaiting_payment", "draft")),
        (Booking.stage == "confirmed") & (Booking.date <= t),
    )).options(*WITH_DETAILS))
    items = []
    for b in bookings:
        link = open_link(b.links)
        ends = starts_at(b.date, b.time) + dt.timedelta(minutes=b.duration_minutes) if b.date and b.time and b.duration_minutes else None
        if b.stage == "confirmed" and ends and ends < moment:
            # The appointment is over and nobody closed it: staff say whether the pet came.
            due = balance(b)
            when = b.time if b.date == t else f"{short_date(b.date)} {b.time}"
            items.append(AttentionItem(
                kind="visit", at=ends, action="Open", link=f"/bookings/{b.id}", booking_id=b.id, balance_paise=due,
                title=f"Did {b.pet.name if b.pet else b.customer.name} come in?",
                detail=f"{when} · {b.service_name} · {b.customer.name}{f' · {inr(due)} to pay' if due else ''}",
            ))
        elif b.stage == "awaiting_payment" and link and link.failed:
            items.append(AttentionItem(kind="failed", at=link.sent_at, action="Send new link", link=f"/bookings/{b.id}",
                                       title=f"Payment failed for {b.id}", detail=f"{b.customer.name} · {inr(link.amount_paise)}"))
        elif b.stage == "awaiting_payment" and link and moment - link.sent_at > nudge:
            items.append(AttentionItem(kind="unpaid", at=link.sent_at, action="Resend", link=f"/bookings/{b.id}", title="Payment link not paid yet",
                                       detail=f"{b.customer.name} · {b.pet.name if b.pet else ''} · sent {age_label(link.sent_at)} ago"))
        elif b.stage == "draft":
            items.append(AttentionItem(
                kind="draft", at=b.created_at, action="Continue", link="/bookings/new", query_params={"from": b.id}, title="Booking left unfinished",
                detail=f"{b.customer.name} · {b.pet.name if b.pet else 'no pet yet'} · {'payment link not sent' if b.date else 'slot not picked yet'}",
            ))
    return sorted(items, key=lambda i: i.at)


def _week_payments(db: Session) -> WeekPayments:
    week = [today() - dt.timedelta(days=d) for d in range(6, -1, -1)]
    received = db.scalars(select(Payment).where(Payment.kind != "refund", Payment.at >= starts_at(week[0], "00:00"))).all()
    by_day = {d: 0 for d in week}
    for p in received:
        if shop_date(p.at) in by_day:
            by_day[shop_date(p.at)] += p.amount_paise
    awaiting = db.scalars(select(Booking).where(Booking.stage == "awaiting_payment").options(*WITH_DETAILS)).all()
    return WeekPayments(
        total_paise=sum(by_day.values()), count=len(received),
        failed=sum(1 for b in awaiting if (link := open_link(b.links)) and link.failed),
        refunds=db.scalar(select(func.count()).select_from(Payment).where(Payment.kind == "refund")),
        days=[DayAmount(date=d, amount_paise=amount) for d, amount in by_day.items()],
    )


def summary(db: Session) -> DashboardOut:
    t, now_time = today(), now().strftime("%H:%M")
    todays = db.scalars(select(Booking).where(Booking.date == t, Booking.stage.in_(HOLDS_SLOT)).order_by(Booking.time).options(*WITH_DETAILS)).all()
    awaiting = db.scalars(select(Booking).where(Booking.stage == "awaiting_payment").options(*WITH_DETAILS)).all()
    links = [link for b in awaiting if (link := open_link(b.links))]
    at_shop = [b for b in todays if b.stage != "awaiting_payment" and balance(b)]
    members = membership_summary(db)
    return DashboardOut(
        renewals_this_week=members.renewing_soon,
        memberships=Memberships(active=members.active, renew_this_week=members.renewing_soon, expired=members.expired_this_month,
                                plans=[PlanCount(name=p.name, count=p.count) for p in members.by_plan]),
        open_stations=sum(st.active for st in list_stations(db)),
        awaiting_payment=AwaitingPayment(count=len(awaiting), outstanding_paise=sum(link.amount_paise for link in links),
                                         failed=sum(link.failed for link in links)),
        today=TodaySummary(
            count=len(todays), done=sum(b.stage == "completed" for b in todays),
            next_time=next((b.time for b in todays if b.stage != "completed" and b.time >= now_time), None),
            due_paise=sum(balance(b) for b in at_shop), due_count=len(at_shop),
        ),
        attention=attention(db),
        schedule=[booking_out(b) for b in todays],
        payments=_week_payments(db),
    )
