"""Bookings: drafts, the bill, confirming, rescheduling, cancelling and closing a visit (root CLAUDE.md › Booking & payment rules).

Still to come: money taken on a booking (advance, payment links, shop payments, refunds: Module 6), and plan sessions and
member discounts on the bill (memberships: Module 7).
"""

import datetime as dt

from fastapi import HTTPException
from sqlalchemy import func, or_, select, update
from sqlalchemy.dialects.postgresql import Range
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.core.dates import now, short_date, starts_at, today
from app.core.money import inr
from app.core.schemas import Paged
from app.grooming.bookings.models import BOOKING_NUMBER, HOLDS_SLOT, STAGES, Booking, BookingActivity
from app.grooming.bookings.schemas import (
    ActivityEntry, BillDiscount, BookingBill, BookingCustomer, BookingDetailsIn, BookingOut, BookingPet, BookingService, CalendarOut, QuoteIn,
)
from app.grooming.catalog.models import Service, Station
from app.grooming.catalog.schemas import StationOut
from app.grooming.offers.models import Offer
from app.grooming.offers.service import status_of
from app.grooming.slots.models import TimeBlock
from app.grooming.slots.service import blocks_on, free_station, held_range, load_day, load_days, opening_span
from app.shared.customers.models import Customer, Pet
from app.shared.settings.service import get_section

COUNTED = ("awaiting_payment", "confirmed", "completed", "no_show")  # a customer's bookings, for offer limits
BOOKED = (*HOLDS_SLOT, "cancelled", "no_show")
TAKEN = "That slot was just taken. Pick another time."

# ── Reading ──


def paid(b: Booking) -> int:
    """Payments minus refunds (payments arrive with Module 6)."""
    return 0


def balance(b: Booking) -> int:
    """Total − paid, never below 0; nothing more is due on a cancelled or no-show booking."""
    return 0 if b.stage in ("cancelled", "no_show") else max(0, (b.total_paise or 0) - paid(b))


def booking_out(b: Booking) -> BookingOut:
    bill = None
    if b.price_paise is not None:
        discount = BillDiscount(kind=b.discount_kind, label=b.discount_label, amount_paise=b.discount_paise, offer_id=b.offer_id) if b.discount_kind else None
        bill = BookingBill(service_price_paise=b.price_paise, discount=discount, total_paise=b.total_paise, advance_paise=b.advance_paise,
                           paid_paise=paid(b), balance_paise=balance(b))
    return BookingOut(
        id=b.id, created_at=b.created_at, source=b.source, stage=b.stage, payment_status=b.payment_status,
        customer=BookingCustomer.model_validate(b.customer), pet=BookingPet.model_validate(b.pet) if b.pet else None,
        service=BookingService(id=b.service_id, name=b.service_name, duration_minutes=b.duration_minutes) if b.service_id else None,
        date=b.date, time=b.time, station_id=b.station_id, bill=bill, offer_code=b.offer_code, booked_by=b.booked_by,
        activity=[ActivityEntry.model_validate(a) for a in sorted(b.activity, key=lambda a: a.id, reverse=True)],  # newest first
    )


def find_booking(db: Session, booking_id: str) -> Booking:
    b = db.get(Booking, booking_id)
    if not b:
        raise HTTPException(status_code=404, detail="Booking not found.")
    return b


def list_bookings(db: Session, stages: list[str], customer_id: str | None, period: str, service_id: str | None, pet_type: str | None,
                  payment_status: str | None, page: int, page_size: int) -> Paged[BookingOut]:
    """Newest first. Drafts without a date yet show in every period."""
    query = select(Booking)
    if stages:
        query = query.where(Booking.stage.in_(stages))
    if customer_id:
        query = query.where(Booking.customer_id == customer_id)
    t = today()
    span = {"today": (t, t), "next7": (t, t + dt.timedelta(days=6)), "last30": (t - dt.timedelta(days=30), t)}.get(period)
    if span:
        query = query.where(or_(Booking.date.is_(None), Booking.date.between(*span)))
    if service_id:
        query = query.where(Booking.service_id == service_id)
    if pet_type:
        query = query.where(Booking.pet.has(Pet.type == pet_type))
    if payment_status:
        query = query.where(Booking.payment_status == payment_status)
    total = db.scalar(select(func.count()).select_from(query.subquery()))
    rows = db.scalars(
        query.order_by(Booking.created_at.desc(), Booking.id.desc()).offset((page - 1) * page_size).limit(page_size)
        .options(selectinload(Booking.customer), selectinload(Booking.pet), selectinload(Booking.activity))
    )
    return Paged(items=[booking_out(b) for b in rows], total=total, page=page, page_size=page_size)


def stage_counts(db: Session) -> dict[str, int]:
    """How many bookings sit in each stage (the Bookings tabs)."""
    counted = dict(db.execute(select(Booking.stage, func.count()).group_by(Booking.stage)).all())
    return {stage: counted.get(stage, 0) for stage in STAGES}


def calendar(db: Session, start: dt.date, days: int) -> CalendarOut:
    dates = [start + dt.timedelta(days=i) for i in range(min(days, 14))]
    loaded = load_days(db, dates)
    bookings = db.scalars(
        select(Booking).where(Booking.date.in_(dates), Booking.stage.in_(HOLDS_SLOT)).order_by(Booking.date, Booking.time)
        .options(selectinload(Booking.customer), selectinload(Booking.pet), selectinload(Booking.activity))
    )
    staff_blocks = list(db.scalars(select(TimeBlock).where(TimeBlock.date.in_(dates)).order_by(TimeBlock.time)))
    opens, closes = opening_span(loaded[0].rules)
    return CalendarOut(
        stations=[StationOut.model_validate(st) for st in loaded[0].stations],
        bookings=[booking_out(b) for b in bookings],
        blocks=[blk for day in loaded for blk in blocks_on(day, [s for s in staff_blocks if s.date == day.date])],
        opens=opens, closes=closes,
    )


# ── The bill ──


def _offer_discount(db: Session, customer_id: str, service: Service, code: str | None, exclude_booking_id: str | None) -> BillDiscount | None:
    """What an offer takes off this service for this customer. A typed code that can't be used is refused with the reason."""
    price = service.price_paise
    # The offers on this customer's other bookings (one entry per booking; None where no offer was used).
    theirs = list(db.scalars(select(Booking.offer_id).where(
        Booking.customer_id == customer_id, Booking.id != exclude_booking_id, Booking.stage.in_(COUNTED))))

    def problem(o: Offer) -> str | None:
        name, status = o.code or o.title, status_of(o)
        if status == "scheduled":
            return f"{name} starts on {short_date(o.starts_on)}."
        if status != "live":
            return f"{name} isn't running right now."
        if o.applies_to == "plans" or (o.applies_to == "some_services" and service.id not in o.service_ids):
            return f"{name} doesn't apply to {service.name}."
        if o.new_customers_only and theirs:
            return f"{name} is for a customer's first booking only."
        if o.per_customer is not None and theirs.count(o.id) >= o.per_customer:
            return f"This customer has already used {name}."
        return None

    def discount(o: Offer) -> BillDiscount:
        amount = (price * o.value + 50) // 100 if o.discount_type == "percent" else min(o.value, price)  # percent rounds half up
        return BillDiscount(kind="offer", label=f"{o.code} · {o.title}" if o.code else o.title, amount_paise=amount, offer_id=o.id)

    if code:
        o = db.scalar(select(Offer).where(Offer.code == code.upper()))
        if not o:
            raise HTTPException(status_code=400, detail=f"There's no offer with the code {code.upper()}.")
        if why := problem(o):
            raise HTTPException(status_code=400, detail=why)
        return discount(o)
    # Automatic offers (no code): the best one that applies.
    automatic = [discount(o) for o in db.scalars(select(Offer).where(Offer.code.is_(None))) if not problem(o)]
    return max(automatic, key=lambda d: d.amount_paise, default=None)


def quote_bill(db: Session, customer_id: str, service: Service, offer_code: str | None, with_advance: bool,
               exclude_booking_id: str | None = None) -> BookingBill:
    """Service price → at most one discount (the best) → total. `with_advance` = booked in the customer app."""
    options: list[BillDiscount] = []  # plan sessions and member discounts join these with memberships (Module 7)
    if offer := _offer_discount(db, customer_id, service, offer_code, exclude_booking_id):
        options.append(offer)
    best = max(options, key=lambda d: d.amount_paise, default=None)
    total = max(0, service.price_paise - (best.amount_paise if best else 0))
    hold = get_section(db, "payments").slot_hold_paise if with_advance else 0
    # The advance is the hold amount, never more than the total, and none when the total is ₹0.
    advance = min(hold, total) if total else 0
    return BookingBill(service_price_paise=service.price_paise, discount=best, total_paise=total, advance_paise=advance, balance_paise=total)


def quote(db: Session, body: QuoteIn) -> BookingBill:
    if not db.get(Customer, body.customer_id):
        raise HTTPException(status_code=404, detail="Customer not found.")
    service = db.get(Service, body.service_id)
    if not service:
        raise HTTPException(status_code=404, detail="Service not found.")
    return quote_bill(db, body.customer_id, service, body.offer_code, with_advance=False)


def _apply_bill(b: Booking, bill: BookingBill) -> None:
    d = bill.discount
    b.price_paise, b.total_paise, b.advance_paise = bill.service_price_paise, bill.total_paise, bill.advance_paise
    b.discount_kind, b.discount_label, b.discount_paise, b.offer_id = (d.kind, d.label, d.amount_paise, d.offer_id) if d else (None, None, 0, None)


def _reserve(db: Session, b: Booking) -> None:
    """A confirmed booking uses its offer. The database adds 1 itself, so two bookings at once are both counted."""
    if b.offer_id:
        db.execute(update(Offer).where(Offer.id == b.offer_id).values(used=Offer.used + 1))


def _release(db: Session, b: Booking) -> None:
    """A cancelled booking gives its offer use back."""
    if b.offer_id:
        db.execute(update(Offer).where(Offer.id == b.offer_id).values(used=func.greatest(Offer.used - 1, 0)))


def _settle(b: Booking) -> None:
    """The payment status from the money. Payments and links (Module 6) add part_paid, link_sent, failed and refunded."""
    b.payment_status = "paid" if b.total_paise == 0 and b.stage in BOOKED else "unpaid"


# ── Changing bookings ──


def _log(b: Booking, kind: str, title: str, detail: str | None = None, by: str | None = None) -> None:
    b.activity.append(BookingActivity(kind=kind, title=title, detail=detail, by=by))


def _hold(b: Booking, station: Station, buffer: int) -> None:
    b.station_id = station.id
    b.held = Range(*held_range(b.date, b.time, b.duration_minutes, buffer))


def _save(db: Session, b: Booking) -> BookingOut:
    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        if "no_double_booking" in str(e.orig):  # someone else took the station a moment ago
            raise HTTPException(status_code=409, detail=TAKEN) from e
        raise
    return booking_out(b)


def save_details(db: Session, booking_id: str | None, body: BookingDetailsIn, by: str) -> BookingOut:
    """Create a draft (no id) or update one: customer, pet, service and, when picked, the slot. A draft holds no slot yet."""
    customer = db.get(Customer, body.customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found.")
    pet = next((p for p in customer.pets if p.id == body.pet_id), None)
    if not pet:
        raise HTTPException(status_code=400, detail="Pick one of the customer's pets.")
    service = db.get(Service, body.service_id)
    if not service:
        raise HTTPException(status_code=400, detail="Pick a service.")
    if service.archived:
        raise HTTPException(status_code=400, detail=f"{service.name} is archived. Pick another service.")
    if service.pet_type != pet.type:
        raise HTTPException(status_code=400, detail=f"{service.name} is for {service.pet_type}s.")
    if body.date and body.time:
        day = load_day(db, body.date, booking_id)
        if body.time in day.closed:
            raise HTTPException(status_code=409, detail="That start time is closed. Pick another time.")
        if not free_station(day, body.time, service, service.duration_minutes):
            raise HTTPException(status_code=409, detail=TAKEN)

    if booking_id:
        b = find_booking(db, booking_id)
        if b.stage != "draft":
            raise HTTPException(status_code=409, detail="Only drafts can be edited here. Use Reschedule instead.")
    else:
        number = db.scalar(select(BOOKING_NUMBER.next_value()))
        b = Booking(id=f"PP-{number}", source="phone", stage="draft", customer=customer, booked_by=by)
        db.add(b)
        _log(b, "created", "Booking started by staff", by=by)

    b.customer, b.pet = customer, pet
    b.service_id, b.service_name, b.duration_minutes = service.id, service.name, service.duration_minutes
    # Phone bookings take no advance.
    _apply_bill(b, quote_bill(db, customer.id, service, body.offer_code, with_advance=False, exclude_booking_id=b.id))
    b.offer_code, b.date, b.time = body.offer_code, body.date, body.time
    _settle(b)
    when = f" · {short_date(body.date)} {body.time}" if body.date and body.time else " · slot not picked yet"
    _log(b, "details", "Booking details saved", f"{service.name}{when}", by)
    return _save(db, b)


def confirm(db: Session, b: Booking, by: str) -> BookingOut:
    """A phone booking: confirmed straight away with no advance (the customer pays at the shop). Prices are fixed now."""
    if b.stage != "draft":
        raise HTTPException(status_code=409, detail="Only drafts can be confirmed.")
    if not (b.service_id and b.date and b.time):
        raise HTTPException(status_code=400, detail="Pick a service and a slot first.")
    service = db.get(Service, b.service_id)
    day = load_day(db, b.date, b.id)
    station = free_station(day, b.time, service, b.duration_minutes)
    if not station:
        raise HTTPException(status_code=409, detail=TAKEN)
    # An offer may have changed since the draft was saved.
    _apply_bill(b, quote_bill(db, b.customer_id, service, b.offer_code, with_advance=False, exclude_booking_id=b.id))
    _hold(b, station, day.rules.buffer_minutes)
    b.stage = "confirmed"
    _reserve(db, b)
    _settle(b)
    _log(b, "status", "Booking confirmed", f"{inr(b.total_paise)} to pay at the shop." if b.total_paise else "Nothing to pay.", by)
    return _save(db, b)


def reschedule(db: Session, b: Booking, date: dt.date, time: str, by: str) -> BookingOut:
    if b.stage not in ("awaiting_payment", "confirmed"):
        raise HTTPException(status_code=409, detail="Only upcoming bookings can be rescheduled.")
    service = db.get(Service, b.service_id)
    day = load_day(db, date, b.id)
    station = free_station(day, time, service, b.duration_minutes)
    if not station:
        raise HTTPException(status_code=409, detail=TAKEN)
    before = f"{short_date(b.date)} {b.time}" if b.date and b.time else "no slot"
    b.date, b.time = date, time
    _hold(b, station, day.rules.buffer_minutes)
    _log(b, "details", "Rescheduled", f"{before} → {short_date(date)} {time}", by)
    return _save(db, b)


def cancel(db: Session, b: Booking, reason: str, by: str) -> BookingOut:
    """Frees the slot and gives back the offer use. (Refunding an advance comes with Module 6.)"""
    if b.stage not in ("draft", "awaiting_payment", "confirmed"):
        raise HTTPException(status_code=409, detail="This booking can't be cancelled.")
    if b.stage == "confirmed":
        _release(db, b)
    b.stage, b.held = "cancelled", None
    _settle(b)
    _log(b, "status", "Booking cancelled", reason.strip() or None, by)
    return _save(db, b)


def close_visit(db: Session, b: Booking, stage: str, by: str) -> BookingOut:
    """Completed or no-show: staff decide once the appointment has started; nothing closes a visit by itself."""
    if b.stage != "confirmed":
        raise HTTPException(status_code=409, detail="Only confirmed bookings can be changed this way.")
    if not b.date or not b.time or starts_at(b.date, b.time) > now():
        raise HTTPException(status_code=409, detail="This appointment hasn't started yet. Mark it completed or a no-show once it has.")
    b.stage = stage
    if stage == "no_show":
        b.held = None  # the rest of its time is free again
    _settle(b)
    due = balance(b) if stage == "completed" else 0
    _log(b, "status", "Marked completed" if stage == "completed" else "Marked as no-show", f"{inr(due)} still to pay." if due else None, by)
    return _save(db, b)


def add_note(db: Session, b: Booking, text: str, by: str) -> BookingOut:
    if not text.strip():
        raise HTTPException(status_code=400, detail="Write a note first.")
    _log(b, "note", "Note", text.strip(), by)
    return _save(db, b)

