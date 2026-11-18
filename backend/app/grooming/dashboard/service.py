"""Everything the Today screen shows, worked out from bookings, payments, memberships and content in a handful of queries."""

import datetime as dt

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.dates import age_label, now, shop_date, short_date, starts_at, today
from app.core.money import inr
from app.grooming.bookings.models import HOLDS_SLOT, Booking
from app.grooming.bookings.service import WITH_DETAILS, balance, booking_out
from app.grooming.catalog.service import list_stations
from app.grooming.dashboard.schemas import (
    AttentionItem, AwaitingPayment, ContentRow, DashboardOut, DayAmount, Memberships, PlanCount, TodaySummary, WeekPayments,
)

PLACEMENTS = {"home_hero": "Home hero", "home_promo": "Home promo strip", "services": "Services page", "membership": "Membership page"}


def _ends_in(ends_on: dt.date | None) -> float:
    return (ends_on - today()).days if ends_on else float("inf")


def _ends_label(ends_on: dt.date) -> str:
    days = (ends_on - today()).days
    return "ends today" if days == 0 else f"ends in {days} day{'' if days == 1 else 's'}"


def content(db: Session) -> list[ContentRow]:
    """The customer app's content at a glance: the banners showing now, photos waiting for a caption, unpublished page drafts."""
    rows = [ContentRow(title=b.title, where=f"{PLACEMENTS[b.placement]} banner", tone="warn" if _ends_in(b.ends_on) <= 3 else "success",
                       status=_ends_label(b.ends_on).capitalize() if _ends_in(b.ends_on) <= 3 else "Live") for b in shown_banners(db)]
    hidden = db.scalar(select(func.count()).select_from(GalleryPhoto).where(GalleryPhoto.visible.is_(False)))
    if hidden:
        rows.append(ContentRow(title=f"{hidden} photo{'' if hidden == 1 else 's'} not shown yet", where="Gallery", status="Hidden", tone="draft"))
    for page in db.scalars(select(SitePage).where(SitePage.draft.is_not(None))):
        rows.append(ContentRow(title=page.title, where=f"Pages & FAQs · draft saved {age_label(page.draft_saved_at)} ago", status="Draft", tone="draft"))
    return rows[:5]
from app.grooming.subscriptions.service import summary as membership_summary
from app.shared.content.models import GalleryPhoto, SitePage
from app.shared.content.service import shown_banners
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
    items.sort(key=lambda i: i.at)
    # Banners ending within 3 days, after the rest.
    for b in shown_banners(db):
        if _ends_in(b.ends_on) <= 3:
            items.append(AttentionItem(kind="content", at=moment, action="Review", link="/banners", title=f"{b.title} banner {_ends_label(b.ends_on)}",
                                       detail=f"{PLACEMENTS[b.placement]} · Banners"))
    return items


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
        content=content(db),
    )
