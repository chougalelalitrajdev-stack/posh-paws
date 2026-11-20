"""Bookings: drafts, the bill, confirming, rescheduling, cancelling, the money on a booking (payment links, payments at the
shop, the advance refund) and closing a visit (root CLAUDE.md › Booking & payment rules).
"""

import datetime as dt

from fastapi import HTTPException
from sqlalchemy import func, or_, select, update
from sqlalchemy.dialects.postgresql import Range
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.core.config import settings
from app.core.dates import now, short_date, starts_at, today
from app.core.money import inr
from app.core.schemas import Paged
from app.grooming.bookings.models import BOOKING_NUMBER, HOLDS_SLOT, STAGES, Booking, BookingActivity
from app.grooming.bookings.schemas import (
    ActivityEntry, AppBookingIn, AppBookingOut, AppQuoteIn, BillDiscount, BookingBill, BookingCustomer, BookingDetailsIn, BookingOut, BookingPet, BookingService, CalendarOut,
    PaymentEntry, PaymentLinkOut, QuoteIn, ShopPaymentIn,
)
from app.grooming.catalog.models import Service, Station
from app.grooming.catalog.schemas import ICONS, StationOut
from app.grooming.offers.models import Offer
from app.grooming.offers.service import status_of
from app.grooming.slots.models import TimeBlock
from app.grooming.slots.service import blocks_on, free_station, held_range, load_day, load_days, opening_span
from app.grooming.subscriptions.service import active_membership, sessions_left, use_session
from app.shared.customers.models import Customer, Pet
from app.shared.payments.models import Payment, PaymentLink
from app.shared.payments.service import METHOD_LABELS, net_paid, open_link, refunded_ids
from app.shared.settings.service import get_section

COUNTED = ("awaiting_payment", "confirmed", "completed", "no_show")  # a customer's bookings, for offer limits
BOOKED = (*HOLDS_SLOT, "cancelled", "no_show")
TAKEN = "That slot was just taken. Pick another time."
APP_TAKEN = "Sorry, that time was just booked by someone else. Please pick another slot."
# What a booking reply needs from other tables, loaded for a whole list in one query each.
WITH_DETAILS = (selectinload(Booking.customer), selectinload(Booking.pet), selectinload(Booking.activity),
                selectinload(Booking.payments), selectinload(Booking.links))

# ── Reading ──


def paid(b: Booking) -> int:
    """Payments minus refunds."""
    return net_paid(b.payments)


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
        payments=[PaymentEntry.model_validate(p) for p in b.payments],
        payment_link=PaymentLinkOut.model_validate(link) if (link := open_link(b.links)) else None,
        activity=[ActivityEntry.model_validate(a) for a in sorted(b.activity, key=lambda a: (a.at, a.id), reverse=True)],  # newest first
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
        query.order_by(Booking.created_at.desc(), Booking.id.desc()).offset((page - 1) * page_size).limit(page_size).options(*WITH_DETAILS)
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
        select(Booking).where(Booking.date.in_(dates), Booking.stage.in_(HOLDS_SLOT)).order_by(Booking.date, Booking.time).options(*WITH_DETAILS)
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


def _offer_discount(db: Session, customer_id: str, service: Service, code: str | None, exclude_booking_id: str | None,
                    in_app: bool = False) -> BillDiscount | None:
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
            return f"{name} is for your first booking only." if in_app else f"{name} is for a customer's first booking only."
        if o.per_customer is not None and theirs.count(o.id) >= o.per_customer:
            return f"You've already used {name}." if in_app else f"This customer has already used {name}."
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


def _bill(db: Session, price: int, discount: BillDiscount | None, with_advance: bool) -> BookingBill:
    total = max(0, price - (discount.amount_paise if discount else 0))
    hold = get_section(db, "payments").slot_hold_paise if with_advance else 0
    # The advance is the hold amount, never more than the total, and none when the total is ₹0.
    advance = min(hold, total) if total else 0
    return BookingBill(service_price_paise=price, discount=discount, total_paise=total, advance_paise=advance, balance_paise=total)


def quote_bill(db: Session, customer_id: str, service: Service, offer_code: str | None, with_advance: bool,
               exclude_booking_id: str | None = None) -> BookingBill:
    """Service price → at most one discount → total. Discounts don't stack: a plan session (₹0) if the member has one left for
    this service, otherwise the better of the member discount and an offer. `with_advance` = booked in the customer app."""
    price = service.price_paise
    member = active_membership(db, customer_id)
    if member and service.id in member.plan.eligible_service_ids and (sessions_left(member) is None or sessions_left(member) > 0):
        # No count in the label: the bill is kept, and a count would go stale.
        return _bill(db, price, BillDiscount(kind="session", label=f"{member.plan.name} plan session", amount_paise=price), with_advance)
    options: list[BillDiscount] = []
    if member and member.plan.discount_percent:
        percent = member.plan.discount_percent
        options.append(BillDiscount(kind="membership", label=f"{member.plan.name} member {percent}% off", amount_paise=(price * percent + 50) // 100))
    if offer := _offer_discount(db, customer_id, service, offer_code, exclude_booking_id, in_app=with_advance):
        options.append(offer)
    return _bill(db, price, max(options, key=lambda d: d.amount_paise, default=None), with_advance)


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
    """A confirmed booking uses its plan session or its offer. The database adds 1 itself, so two bookings at once are both counted."""
    if b.discount_kind == "session":
        use_session(db, b.customer_id)
    if b.offer_id:
        db.execute(update(Offer).where(Offer.id == b.offer_id).values(used=Offer.used + 1))


def _release(db: Session, b: Booking) -> None:
    """A cancelled booking gives its session or offer use back (a no-show keeps them used)."""
    if b.discount_kind == "session":
        use_session(db, b.customer_id, give_back=True)
    if b.offer_id:
        db.execute(update(Offer).where(Offer.id == b.offer_id).values(used=func.greatest(Offer.used - 1, 0)))


def settle(b: Booking) -> None:
    """The payment status, worked out from the bill, the payments and any open link (root CLAUDE.md › Payment status).
    Call it after anything that changes the money or the stage."""
    got, link, total = paid(b), open_link(b.links), b.total_paise or 0
    if any(p.kind == "refund" for p in b.payments) and got <= 0:
        b.payment_status = "refunded"
    elif b.price_paise is not None and b.stage in BOOKED and (balance(b) == 0 or total == 0) and (got > 0 or total == 0):
        b.payment_status = "paid"  # also when the total is ₹0
    elif got > 0:
        b.payment_status = "part_paid"
    elif link:
        b.payment_status = "failed" if link.failed else "link_sent"
    else:
        b.payment_status = "unpaid"


# ── Changing bookings ──


def log(b: Booking, kind: str, title: str, detail: str | None = None, by: str | None = None) -> None:
    """A line in the booking's history."""
    b.activity.append(BookingActivity(kind=kind, title=title, detail=detail, by=by))


def add_payment(b: Booking, kind: str, amount: int, method: str, by: str | None = None, refund_of: str | None = None) -> Payment:
    """A row in the payments table for this booking: PAY-1051-1, PAY-1051-2, ..."""
    entry = Payment(id=f"PAY-{b.id.removeprefix('PP-')}-{len(b.payments) + 1}", customer_id=b.customer_id, kind=kind, amount_paise=amount,
                    method=method, by=by, refund_of=refund_of)
    b.payments.append(entry)
    return entry


def _close_link(b: Booking) -> None:
    """The open link was paid, replaced, or isn't needed any more."""
    if link := open_link(b.links):
        link.closed_at = dt.datetime.now(dt.timezone.utc)


def _hold(b: Booking, station: Station, buffer: int) -> None:
    b.station_id = station.id
    b.held = Range(*held_range(b.date, b.time, b.duration_minutes, buffer))


def save(db: Session, b: Booking) -> BookingOut:
    """Commits the change and answers with the booking. A clash on the station (someone else just took it) is a 409."""
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
        log(b, "created", "Booking started by staff", by=by)

    b.customer, b.pet = customer, pet
    b.service_id, b.service_name, b.duration_minutes = service.id, service.name, service.duration_minutes
    # Phone bookings take no advance.
    _apply_bill(b, quote_bill(db, customer.id, service, body.offer_code, with_advance=False, exclude_booking_id=b.id))
    b.offer_code, b.date, b.time = body.offer_code, body.date, body.time
    settle(b)
    when = f" · {short_date(body.date)} {body.time}" if body.date and body.time else " · slot not picked yet"
    log(b, "details", "Booking details saved", f"{service.name}{when}", by)
    return save(db, b)


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
    settle(b)
    due = f"{inr(b.total_paise)} to pay at the shop." if b.total_paise else "Covered by the plan session; nothing to pay." if b.discount_kind == "session" else "Nothing to pay."
    log(b, "status", "Booking confirmed", due, by)
    return save(db, b)


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
    log(b, "details", "Rescheduled", f"{before} → {short_date(date)} {time}", by)
    return save(db, b)


def _refund_advance(db: Session, b: Booking) -> str | None:
    """On cancel: an online advance is refunded when the slot is at least `freeCancellationHours` away, otherwise kept.
    Returns the line for the activity log, or None when no advance was paid."""
    gone = refunded_ids(b.payments)
    advances = [p for p in b.payments if p.kind == "advance" and p.method == "online" and p.id not in gone]
    amount = sum(p.amount_paise for p in advances)
    if not amount:
        return None
    hours = get_section(db, "payments").free_cancellation_hours
    if b.date and b.time and starts_at(b.date, b.time) - now() < dt.timedelta(hours=hours):
        return f"The {inr(amount)} advance is kept (cancelled less than {hours} h before)."
    for p in advances:
        add_payment(b, "refund", p.amount_paise, "online", refund_of=p.id)
    return f"The {inr(amount)} advance was refunded (cancelled {hours} h or more before)."


def cancel(db: Session, b: Booking, reason: str, by: str) -> BookingOut:
    """Frees the slot and gives back the offer use. The advance follows the refund rule; other payments are refunded from Payments."""
    if b.stage not in ("draft", "awaiting_payment", "confirmed"):
        raise HTTPException(status_code=409, detail="This booking can't be cancelled.")
    if b.stage == "confirmed":
        _release(db, b)
    b.stage, b.held = "cancelled", None
    _close_link(b)
    advance = _refund_advance(db, b)
    gone = refunded_ids(b.payments)
    others = "Other payments can be refunded from Payments." if any(p.kind == "balance" and p.id not in gone for p in b.payments) else None
    settle(b)
    log(b, "status", "Booking cancelled", " ".join(x for x in (reason.strip(), advance, others) if x) or None, by)
    return save(db, b)


def _must_have_started(b: Booking) -> None:
    if not b.date or not b.time or starts_at(b.date, b.time) > now():
        raise HTTPException(status_code=409, detail="This appointment hasn't started yet. Mark it completed or a no-show once it has.")


def _close(b: Booking, stage: str, by: str) -> None:
    b.stage = stage
    if stage == "no_show":
        b.held = None  # the rest of its time is free again; the advance is kept and nothing more is owed
    settle(b)
    due = balance(b) if stage == "completed" else 0
    log(b, "status", "Marked completed" if stage == "completed" else "Marked as no-show", f"{inr(due)} still to pay." if due else None, by)


def close_visit(db: Session, b: Booking, stage: str, by: str) -> BookingOut:
    """Completed or no-show: staff decide once the appointment has started; nothing closes a visit by itself."""
    if b.stage != "confirmed":
        raise HTTPException(status_code=409, detail="Only confirmed bookings can be changed this way.")
    _must_have_started(b)
    _close(b, stage, by)
    return save(db, b)


# ── Money on a booking ──


def payment_link(db: Session, b: Booking, amount_type: str, by: str) -> BookingOut:
    """Sends (or re-sends) a payment link. Before the booking is confirmed it asks for the advance (hold) or the full amount
    and holds the slot; after, it asks for the balance."""
    if b.stage not in ("draft", "awaiting_payment", "confirmed", "completed"):
        raise HTTPException(status_code=409, detail="This booking doesn't need a payment link.")
    if not (b.service_id and b.date and b.time and b.price_paise is not None):
        raise HTTPException(status_code=400, detail="Pick a service and a slot first.")
    settings = get_section(db, "payments")
    before, link = b.stage in ("draft", "awaiting_payment"), open_link(b.links)
    if before:
        service = db.get(Service, b.service_id)
        day = load_day(db, b.date, b.id)
        station = free_station(day, b.time, service, b.duration_minutes)
        if not station:
            raise HTTPException(status_code=409, detail=TAKEN)
        if b.stage != "awaiting_payment":
            _apply_bill(b, quote_bill(db, b.customer_id, service, b.offer_code, with_advance=False, exclude_booking_id=b.id))
        if not b.total_paise:
            raise HTTPException(status_code=409, detail="Nothing to pay: the plan session covers it. Confirm the booking instead."
                                if b.discount_kind == "session" else "Nothing to pay on this booking. Confirm it instead.")
        # A re-sent link asks for the same as before.
        kind = link.amount_type if b.stage == "awaiting_payment" and link else amount_type
        amount = min(settings.slot_hold_paise, b.total_paise) if kind == "hold" else b.total_paise
        _hold(b, station, day.rules.buffer_minutes)
        b.stage = "awaiting_payment"
    else:
        kind, amount = "full", balance(b)
        if not amount:
            raise HTTPException(status_code=409, detail="Nothing left to pay on this booking.")
    sent = dt.datetime.now(dt.timezone.utc)
    _close_link(b)
    # A demo address until the payment gateway is connected (Module 12).
    url = f"https://pay.poshpaws.in/l/{b.id}" + (f"-{int(sent.timestamp()):x}" if link else "")
    b.links.append(PaymentLink(customer_id=b.customer_id, amount_type=kind, amount_paise=amount, url=url, sent_at=sent,
                               expires_at=sent + dt.timedelta(hours=settings.link_expiry_hours)))
    settle(b)
    title = "New payment link sent" if link else "Payment link sent on WhatsApp" if before else "Balance link sent on WhatsApp"
    log(b, "payment", title, inr(amount), by)
    return save(db, b)


def pay_link(db: Session, b: Booking) -> BookingOut:
    """Stands in for the customer paying the open link until the payment gateway is connected (Module 12): the admin's
    "Demo: customer pays online". Paying before the visit confirms the booking."""
    if settings.production or get_section(db, "payments").provider:  # a stand-in for your Mac only
        raise HTTPException(status_code=409, detail="Online payments come from the payment gateway.")
    link = open_link(b.links)
    if not link:
        raise HTTPException(status_code=409, detail="There's no open payment link.")
    confirming = b.stage == "awaiting_payment"
    _close_link(b)
    add_payment(b, "advance" if confirming else "balance", link.amount_paise, "online")
    if confirming:
        b.stage = "confirmed"
        _reserve(db, b)
    settle(b)
    log(b, "payment", "Paid online", f"{inr(link.amount_paise)}{' · booking confirmed automatically' if confirming else ''}")
    return save(db, b)


def record_payment(db: Session, b: Booking, body: ShopPaymentIn, by: str) -> BookingOut:
    """Money taken at the shop (shop UPI QR, cash or card), up to the balance. Taking it before the visit confirms the booking.
    With `complete` (checkout), the visit is marked completed too."""
    if b.stage not in ("awaiting_payment", "confirmed", "completed") or b.price_paise is None:
        raise HTTPException(status_code=409, detail="Only booked or completed bookings take payments.")
    due = balance(b)
    if body.amount_paise > due:
        raise HTTPException(status_code=400, detail=f"The balance is {inr(due)}. Enter that or less.")
    if body.complete:
        _must_have_started(b)
    confirming = b.stage == "awaiting_payment"
    add_payment(b, "advance" if confirming else "balance", body.amount_paise, body.method, by)
    if confirming:
        b.stage = "confirmed"
        _close_link(b)
        _reserve(db, b)
    elif not balance(b):
        _close_link(b)  # a balance link isn't needed any more
    settle(b)
    left = f" · {inr(balance(b))} still due" if balance(b) else " · paid in full"
    log(b, "payment", "Payment taken at the shop", f"{inr(body.amount_paise)} by {METHOD_LABELS[body.method]}{left}", by)
    if body.complete and b.stage == "confirmed":
        _close(b, "completed", by)  # checkout: the pet came and is going home
    return save(db, b)


def add_note(db: Session, b: Booking, text: str, by: str) -> BookingOut:
    if not text.strip():
        raise HTTPException(status_code=400, detail="Write a note first.")
    log(b, "note", "Note", text.strip(), by)
    return save(db, b)


# ── The customer app: a customer's own bookings ──

APP_STAGES = ("confirmed", "completed", "cancelled", "no_show")  # drafts and links waiting to be paid aren't the customer's to see yet
UPCOMING_LIMIT = 5


def app_booking_out(b: Booking, icon: str) -> AppBookingOut:
    out = booking_out(b)
    return AppBookingOut(
        id=b.id, service_id=b.service_id, service_name=b.service_name, service_icon=icon, pet_id=b.pet_id, pet_name=b.pet.name,
        pet_type=b.pet.type, date=b.date, time=b.time, duration_minutes=b.duration_minutes, bill=out.bill, payments=out.payments,
        payment_status=b.payment_status, offer_code=b.offer_code, notes=b.customer_note, status=b.stage, created_at=b.created_at,
    )


def _icon(db: Session, b: Booking) -> str:
    service = db.get(Service, b.service_id)
    return ICONS.get(service.category, "🐾") if service else "🐾"


def my_bookings(db: Session, c: Customer) -> list[AppBookingOut]:
    """Newest appointment first."""
    rows = db.scalars(select(Booking).where(Booking.customer_id == c.id, Booking.stage.in_(APP_STAGES), Booking.pet_id.is_not(None))
                      .order_by(Booking.date.desc(), Booking.time.desc()).options(*WITH_DETAILS))
    return [app_booking_out(b, _icon(db, b)) for b in rows]


def _bookable_service(db: Session, service_id: str) -> Service:
    """Customers can book only what the app shows."""
    service = db.get(Service, service_id)
    if not service or not service.visible or service.archived:
        raise HTTPException(status_code=404, detail="Service not found.")
    return service


def app_quote(db: Session, c: Customer, body: AppQuoteIn) -> BookingBill:
    return quote_bill(db, c.id, _bookable_service(db, body.service_id), body.offer_code, with_advance=True)


def book_in_app(db: Session, c: Customer, body: AppBookingIn) -> AppBookingOut:
    """The customer books and pays the advance, which confirms the booking (a ₹0 plan session needs no advance).
    Until the payment gateway is connected (Module 12) the advance is a stand-in, so online booking is closed in production."""
    if settings.production and not get_section(db, "payments").provider:
        raise HTTPException(status_code=503, detail="Online booking opens soon. Please call us to book.")
    service = _bookable_service(db, body.service_id)
    pet = db.get(Pet, body.pet_id)
    if not pet or pet.customer_id != c.id:
        raise HTTPException(status_code=404, detail="Pet not found.")
    if service.pet_type != pet.type:
        raise HTTPException(status_code=400, detail=f"{service.name} is for {service.pet_type}s.")
    upcoming = db.scalar(select(func.count()).select_from(Booking).where(
        Booking.customer_id == c.id, Booking.stage.in_(("awaiting_payment", "confirmed")), Booking.date >= today()))
    if upcoming >= UPCOMING_LIMIT:
        raise HTTPException(status_code=409, detail=f"You already have {UPCOMING_LIMIT} upcoming bookings. Call us to book more.")
    day = load_day(db, body.date)
    station = free_station(day, body.time, service, service.duration_minutes, customer=True)
    if not station:
        raise HTTPException(status_code=409, detail=APP_TAKEN)
    bill = quote_bill(db, c.id, service, body.offer_code, with_advance=True)

    number = db.scalar(select(BOOKING_NUMBER.next_value()))
    b = Booking(id=f"PP-{number}", source="app", stage="confirmed", customer_id=c.id, customer=c, pet_id=pet.id, pet=pet,
                service_id=service.id, service_name=service.name,
                duration_minutes=service.duration_minutes, date=body.date, time=body.time, offer_code=body.offer_code if bill.discount and
                bill.discount.kind == "offer" else None, customer_note=body.notes)
    db.add(b)
    _apply_bill(b, bill)
    _hold(b, station, day.rules.buffer_minutes)
    _reserve(db, b)
    log(b, "created", "Booked in the app", f"{service.name} · {short_date(body.date)} {body.time}")
    if body.notes:
        log(b, "note", "Note from the customer", body.notes)
    if b.advance_paise:
        add_payment(b, "advance", b.advance_paise, "online")
        log(b, "payment", "Advance paid in the app", inr(b.advance_paise))
    settle(b)
    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        if "no_double_booking" in str(e.orig):
            raise HTTPException(status_code=409, detail=APP_TAKEN) from e
        raise
    return app_booking_out(b, ICONS.get(service.category, "🐾"))


def my_booking(db: Session, c: Customer, booking_id: str) -> Booking:
    """One of this customer's bookings. Anyone else's booking is "not found", the same as one that doesn't exist."""
    b = db.get(Booking, booking_id)
    if not b or b.customer_id != c.id or b.stage not in APP_STAGES:
        raise HTTPException(status_code=404, detail="Booking not found.")
    return b


def cancel_in_app(db: Session, b: Booking) -> AppBookingOut:
    """Before the appointment starts. The advance follows the refund rule (24 h or more before: refunded)."""
    if b.stage != "confirmed" or starts_at(b.date, b.time) <= now():
        raise HTTPException(status_code=409, detail="This booking can't be cancelled any more.")
    cancel(db, b, "Cancelled by the customer in the app.", None)
    return app_booking_out(b, _icon(db, b))
