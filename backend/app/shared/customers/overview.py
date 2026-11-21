"""A customer's overview across the business: visits, bookings, money paid and membership, the Activity tab, a pet's visits,
and the top-bar search.

The one place shared code reads modules' tables (a customer's profile shows everything about them). Grooming now; the store
and vet care add their numbers here when they arrive.
"""

import datetime as dt
import re

from sqlalchemy import ColumnElement, case, exists, func, or_, select, true
from sqlalchemy.orm import Session, selectinload

from app.core.dates import now, starts_at, today
from app.grooming.bookings.models import Booking
from app.grooming.bookings.schemas import ActivityEntry
from app.grooming.plans.models import Plan
from app.grooming.subscriptions.models import Subscription
from app.grooming.subscriptions.service import change_text, customer_plan
from app.shared.customers.models import Breed, Customer, Pet
from app.shared.customers.schemas import CustomerSummaryOut, LastVisit, NextUp, SearchResults, Visit
from app.shared.payments.models import Payment

LAPSED_DAYS = 90
UPCOMING = ("awaiting_payment", "confirmed")

# ── Numbers the list can filter and sort by (worked out inside the database, per customer row) ──


def _last_visit():
    return select(func.max(Booking.date)).where(Booking.customer_id == Customer.id, Booking.stage == "completed").scalar_subquery()


def _spent():
    """Everything they've paid: bookings and memberships, minus refunds."""
    signed = case((Payment.kind == "refund", -Payment.amount_paise), else_=Payment.amount_paise)
    return select(func.coalesce(func.sum(signed), 0)).where(Payment.customer_id == Customer.id).scalar_subquery()


def _is_member():
    return exists().where(Subscription.customer_id == Customer.id, Subscription.status == "active")


def in_segment(segment: str) -> ColumnElement[bool]:
    """The tabs on the Customers page."""
    if segment == "new":
        return Customer.customer_since >= now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    if segment == "members":
        return _is_member()
    if segment == "no_plan":
        return ~_is_member()
    if segment == "lapsed":
        return _last_visit() < today() - dt.timedelta(days=LAPSED_DAYS)  # seen before, but not in 90 days
    return true()


def on_plan(name: str) -> ColumnElement[bool]:
    """The Plan filter: a plan's name, or "none"."""
    if name == "none":
        return ~_is_member()
    return exists().where(Subscription.customer_id == Customer.id, Subscription.status == "active", Subscription.plan_id == Plan.id, Plan.name == name)


def sort_order(sort: str) -> list:
    if sort == "name":
        return [Customer.name]
    if sort == "spent":
        return [_spent().desc()]
    return [_last_visit().desc().nulls_last(), Customer.customer_since.desc()]


# ── Numbers for the rows on one page (a few queries for the whole page) ──


def summaries(db: Session, customers: list[Customer]) -> list[CustomerSummaryOut]:
    ids = [c.id for c in customers]
    if not ids:
        return []
    mine = Booking.customer_id.in_(ids)
    counts = dict(db.execute(select(Booking.customer_id, func.count()).where(mine, Booking.stage != "draft").group_by(Booking.customer_id)).all())
    visits = dict(db.execute(select(Booking.customer_id, func.max(Booking.date)).where(mine, Booking.stage == "completed").group_by(Booking.customer_id)).all())
    signed = case((Payment.kind == "refund", -Payment.amount_paise), else_=Payment.amount_paise)
    spent = dict(db.execute(select(Payment.customer_id, func.sum(signed)).where(Payment.customer_id.in_(ids)).group_by(Payment.customer_id)).all())
    plans = dict(db.execute(select(Subscription.customer_id, Plan.name).join(Plan, Subscription.plan_id == Plan.id)
                            .where(Subscription.customer_id.in_(ids), Subscription.status == "active")).all())
    upcoming: dict[str, Booking] = {}
    for b in db.scalars(select(Booking).where(mine, Booking.stage.in_(UPCOMING), Booking.date >= today()).order_by(Booking.date, Booking.time)):
        upcoming.setdefault(b.customer_id, b)
    drafts = set(db.scalars(select(Booking.customer_id).where(mine, Booking.stage == "draft")))
    lapsed_before = today() - dt.timedelta(days=LAPSED_DAYS)

    def row(c: Customer) -> CustomerSummaryOut:
        nxt = upcoming.get(c.id)
        return CustomerSummaryOut(
            id=c.id, name=c.name, phone=c.phone, pet_names=[p.name for p in c.pets], plan_name=plans.get(c.id),
            bookings_count=counts.get(c.id, 0), spent_paise=spent.get(c.id, 0), last_visit=visits.get(c.id),
            lapsed=bool(visits.get(c.id) and visits[c.id] < lapsed_before),
            next=NextUp(kind="booking", date=nxt.date, time=nxt.time) if nxt else NextUp(kind="draft") if c.id in drafts else None,
        )

    return [row(c) for c in customers]


def profile_numbers(db: Session, c: Customer) -> dict:
    """The numbers at the top of a customer's profile, and their plan card."""
    bookings = list(db.scalars(select(Booking).where(Booking.customer_id == c.id).options(selectinload(Booking.pet))))
    completed = sorted((b for b in bookings if b.stage == "completed" and b.date), key=lambda b: b.date)
    last = completed[-1] if completed else None
    member = db.scalar(select(Subscription).where(Subscription.customer_id == c.id, Subscription.status == "active")
                       .options(selectinload(Subscription.plan), selectinload(Subscription.next_plan)))
    return {
        "plan": customer_plan(member),
        "bookings_count": sum(b.stage != "draft" for b in bookings),
        "past_bookings": len(completed),
        "spent_paise": db.scalar(select(_spent()).where(Customer.id == c.id)),
        "last_visit": LastVisit(date=last.date, service_name=last.service_name or "", pet_name=last.pet.name if last.pet else "") if last else None,
    }


# ── The Activity tab and a pet's visits ──


def activity(db: Session, c: Customer) -> list[ActivityEntry]:
    """Everything that happened for this customer, newest first: their bookings' history, plan changes, joining."""
    entries = []
    for b in db.scalars(select(Booking).where(Booking.customer_id == c.id).options(selectinload(Booking.activity), selectinload(Booking.pet))):
        for a in b.activity:
            detail = " · ".join(x for x in (b.id, b.pet.name if b.pet else None, a.detail) if x)
            entries.append(ActivityEntry(at=a.at, kind=a.kind, title=a.title, detail=detail, by=a.by))
    for s in db.scalars(select(Subscription).where(Subscription.customer_id == c.id).options(selectinload(Subscription.changes))):
        first_plan = s.changes[-1].from_plan if s.changes else s.plan_name
        entries.append(ActivityEntry(at=starts_at(s.started_on, "10:00"), kind="payment", title=f"Joined the {first_plan} plan"))
        for change in s.changes:
            title, detail = change_text(change, s.renews_on)
            entries.append(ActivityEntry(at=change.at, kind="status", title=title, detail=detail, by=change.by))
        if s.ended_on:
            entries.append(ActivityEntry(at=starts_at(s.ended_on, "10:00"), kind="status",
                                         title=f"{s.plan_name} plan {'cancelled' if s.status == 'cancelled' else 'expired'}"))
    entries.append(ActivityEntry(at=c.customer_since, kind="created", title="Became a customer"))
    return sorted(entries, key=lambda e: e.at, reverse=True)[:40]


def pet_visits(db: Session, pet_id: str) -> list[Visit]:
    """A pet's completed grooms, newest first."""
    done = db.scalars(select(Booking).where(Booking.pet_id == pet_id, Booking.stage == "completed", Booking.date.is_not(None))
                      .order_by(Booking.date.desc()))
    return [Visit(booking_id=b.id, service_name=b.service_name or "", date=b.date) for b in done]


def last_grooms(db: Session, pet_ids: list[str]) -> dict[str, dt.date]:
    return dict(db.execute(select(Booking.pet_id, func.max(Booking.date)).where(Booking.pet_id.in_(pet_ids), Booking.stage == "completed")
                           .group_by(Booking.pet_id)).all())


# ── Top-bar search ──


def search(db: Session, q: str, limit: int = 5) -> SearchResults:
    """Customers (name, phone, pet), pets (name, breed) and bookings (ID): a few of each."""
    q = q.strip()
    if len(q) < 2:
        return SearchResults(customers=[], pets=[], bookings=[])
    text, digits = q, re.sub(r"\D", "", q)
    found = [Customer.name.icontains(text, autoescape=True), Customer.pets.any(Pet.name.icontains(text, autoescape=True))]
    if len(digits) >= 3:
        found.append(Customer.phone.contains(digits))
    customers = db.scalars(select(Customer).where(or_(*found)).order_by(Customer.name).limit(limit).options(selectinload(Customer.pets)))
    pets = db.scalars(select(Pet).where(or_(Pet.name.icontains(text, autoescape=True), Pet.breed_ref.has(Breed.name.icontains(text, autoescape=True))))
                      .order_by(Pet.name).limit(limit).options(selectinload(Pet.owner)))
    by_id = [Booking.id.icontains(text, autoescape=True)] + ([Booking.id.contains(digits)] if len(digits) >= 3 else [])
    bookings = db.scalars(select(Booking).where(or_(*by_id)).order_by(Booking.created_at.desc()).limit(limit)
                          .options(selectinload(Booking.customer), selectinload(Booking.pet)))
    return SearchResults(
        customers=[{"id": c.id, "name": c.name, "phone": c.phone, "pet_names": [p.name for p in c.pets]} for c in customers],
        pets=[{"id": p.id, "name": p.name, "type": p.type, "breed": p.breed, "owner_name": p.owner.name} for p in pets],
        bookings=[{"id": b.id, "customer_name": b.customer.name, "pet_name": b.pet.name if b.pet else None, "service_name": b.service_name,
                   "date": b.date, "time": b.time, "stage": b.stage} for b in bookings],
    )
