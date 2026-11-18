"""Reading and saving settings (defaults until a section is first saved), holidays and the usual week's start times."""

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.dates import TIME, minutes_of_day, today
from app.grooming.bookings.models import Booking
from app.shared.settings.models import Closure, SettingsRow
from app.shared.settings.schemas import (
    AppSettings, BookingRules, BookingSettingsOut, BusinessSettings, ClosureIn, ClosureOut, DayHours,
    NotificationSettings, PaymentSettings, SettingsOut, WeekBoardOut, WeekDay, WeekSlot, in_break, starts_in,
)

# What a fresh database answers with until staff save a section. Real starting values, not demo data.
DEFAULTS = {
    "business": BusinessSettings(name="Posh Paws Pet Grooming"),
    "booking": BookingRules(
        hours=[DayHours(day=d, open=True, opens="09:00", closes="19:00", break_from="14:00", break_to="14:30", closed_starts=[], extra_starts=[]) for d in range(7)],
        slot_step_minutes=30, buffer_minutes=15, book_ahead_days=30, min_notice_minutes=30,
    ),
    "payments": PaymentSettings(link_expiry_hours=24, slot_hold_paise=10_000, free_cancellation_hours=24),
    "notifications": NotificationSettings(reminder_time="18:00", unpaid_nudge_hours=6, staff_alerts="admins"),
    "app": AppSettings(book_button_text="Book now", show_prices=True),
}

DAY_PLURALS = ["Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays", "Sundays"]


# ── Sections ──


def get_section(db: Session, name: str):
    """A section's options: what's saved, or the defaults if it was never saved."""
    row = db.get(SettingsRow, name)
    model = type(DEFAULTS[name])
    return model.model_validate(row.value) if row else DEFAULTS[name].model_copy(deep=True)


def booking_rules(db: Session) -> BookingRules:
    """Hours, breaks and slot rules (the slot engine reads these)."""
    return get_section(db, "booking")


def _store(db: Session, name: str, value, by: str) -> None:
    row = db.get(SettingsRow, name) or SettingsRow(section=name)
    row.value, row.updated_by = value.model_dump(mode="json"), by
    db.add(row)
    db.commit()


def save_section(db: Session, name: str, value, by: str) -> SettingsOut:
    if name == "booking":
        # Weekly closed and extra start times are changed on Availability › Week; keep them unless sent.
        current = booking_rules(db)
        for h in value.hours:
            if h.closed_starts is None:
                h.closed_starts = current.hours[h.day].closed_starts
            if h.extra_starts is None:
                h.extra_starts = current.hours[h.day].extra_starts
    if name == "payments":
        value.provider = get_section(db, "payments").provider  # set by the server when a gateway is connected
    _store(db, name, value, by)
    return all_settings(db)


def all_settings(db: Session) -> SettingsOut:
    """GET /admin/settings: every section, with the holidays in date order."""
    return SettingsOut(
        business=get_section(db, "business"),
        booking=BookingSettingsOut(**booking_rules(db).model_dump(), closures=list_closures(db)),
        payments=get_section(db, "payments"),
        notifications=get_section(db, "notifications"),
        app=get_section(db, "app"),
    )


# ── Holidays ──


def _bookings_to_move(db: Session, c: Closure) -> int:
    """Bookings already made that the holiday falls on: all that day, or those still running when it closes early.
    (Settings reads grooming's bookings here, the one place it looks at a module's table; vet visits will join later.)"""
    closes = minutes_of_day(c.closes_at) if c.closes_at else 0
    booked = db.scalars(select(Booking).where(Booking.date == c.date, Booking.stage.in_(("awaiting_payment", "confirmed"))))
    return sum(1 for b in booked if b.time and minutes_of_day(b.time) + (b.duration_minutes or 0) > closes)


def _closure_out(db: Session, c: Closure) -> ClosureOut:
    return ClosureOut.model_validate(c).model_copy(update={"affected_bookings": _bookings_to_move(db, c)})


def list_closures(db: Session) -> list[ClosureOut]:
    return [_closure_out(db, c) for c in db.scalars(select(Closure).order_by(Closure.date))]


def add_closure(db: Session, body: ClosureIn) -> ClosureOut:
    if body.date < today():
        raise HTTPException(status_code=400, detail="Pick today or a later date.")
    if db.scalar(select(Closure).where(Closure.date == body.date)):
        raise HTTPException(status_code=409, detail="There is already a closure on that day.")
    closure = Closure(date=body.date, name=body.name, closes_at=body.closes_at)
    db.add(closure)
    db.commit()
    return _closure_out(db, closure)


def remove_closure(db: Session, closure_id: str) -> SettingsOut:
    closure = db.get(Closure, closure_id)
    if not closure:
        raise HTTPException(status_code=404, detail="Closure not found.")
    db.delete(closure)
    db.commit()
    return all_settings(db)


# ── The usual week's start times ──


def week_board(db: Session) -> WeekBoardOut:
    """Each weekday's start times, with what's closed or added every week and what falls in the break."""
    rules = booking_rules(db)
    step = rules.slot_step_minutes
    days = []
    for h in rules.hours:
        extras = h.extra_starts if h.open else []

        def state(time: str) -> str:
            if time in extras:
                return "extra"
            if time in h.closed_starts:
                return "closed"
            return "break" if in_break(h, time) else "open"

        times = sorted(set(starts_in(h, step, step)) | set(extras))
        days.append(WeekDay(**h.model_dump(), slots=[WeekSlot(time=t, state=state(t)) for t in times]))
    return WeekBoardOut(step_minutes=step, days=days)


def set_week_slot(db: Session, weekday: int, time: str, open: bool, by: str) -> WeekBoardOut:
    """Close or open a start time every week on one weekday. Opening a break or after-hours time makes it a weekly extra."""
    if not TIME.match(time):
        raise HTTPException(status_code=400, detail="Enter a time like 18:30.")
    rules = booking_rules(db)
    h = rules.hours[weekday]
    if not h.open:
        raise HTTPException(status_code=409, detail=f"{DAY_PLURALS[weekday]} are closed. Open the day in the hours below first.")
    usual = time in starts_in(h, rules.slot_step_minutes, rules.slot_step_minutes) and not in_break(h, time)
    if open:
        h.closed_starts = [t for t in h.closed_starts if t != time]
        if not usual and time not in h.extra_starts:
            h.extra_starts = sorted([*h.extra_starts, time])
    elif time in h.extra_starts:
        h.extra_starts = [t for t in h.extra_starts if t != time]
    elif usual:
        h.closed_starts = sorted({*h.closed_starts, time})
    else:
        raise HTTPException(status_code=404, detail=f"That isn't a start time on {DAY_PLURALS[weekday]}.")
    _store(db, "booking", rules, by)
    return week_board(db)
