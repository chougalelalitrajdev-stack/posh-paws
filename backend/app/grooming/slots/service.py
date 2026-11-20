"""When customers can book: open start times, a free station for a visit, the day's slot board, and block time.

Strongest first (root CLAUDE.md › Slots): a holiday, that day's changes, the weekly pattern, the opening hours.
A held-back station is the customers' only at the start times staff open for it; staff can always book it, and get it last.
Closing or opening a start time for the day (or every week) changes only the usual stations; a held-back station follows its own times.
Inside a day, times are minutes from midnight ("09:30" = 570), in the shop's timezone.
"""

import datetime as dt
from dataclasses import dataclass, field

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.dates import TIME, local, minutes_of_day, now, starts_at, time_from_minutes, today
from app.grooming.bookings.models import Booking
from app.grooming.catalog.models import Service, Station
from app.grooming.catalog.service import list_stations
from app.grooming.slots.models import DayChanges, StationOpening, TimeBlock
from app.grooming.slots.schemas import (
    BoardSlot, ClosureNote, DayAvailability, HeldBackStation, SlotBoardOut, TimeBlockIn, TimeBlockOut, TimeSlot,
)
from app.shared.settings.models import Closure
from app.shared.settings.schemas import BookingRules, DayHours, starts_in
from app.shared.settings.service import booking_rules

MAX_DAYS = 14


@dataclass
class Day:
    """Everything that decides one date's start times, read from the database once (see load_days)."""

    date: dt.date
    rules: BookingRules
    hours: DayHours  # that weekday's usual hours
    closure: Closure | None
    closed: list[str]  # start times closed (every week or just today)
    extra: list[str]  # start times opened on top (every week or just today)
    weekly_extra: list[str]
    stations: list[Station]  # all of them, in calendar order
    services: list[Service]  # bookable ones, to compare how specialised stations are
    fixed: list[tuple[int, int, str]]  # breaks and holiday closing, the same on every station: (from, to, reason)
    taken: dict[str, list[tuple[int, int]]] = field(default_factory=dict)  # per station: bookings (cleaning included) and blocks
    blocks: dict[str, list[tuple[int, int]]] = field(default_factory=dict)  # per station: just the blocks (to say why it's busy)
    opened: dict[str, list[str]] = field(default_factory=dict)  # per held-back station: start times opened to customers


def opening_span(rules: BookingRules) -> tuple[str, str]:
    """The earliest opening and latest closing in the week, for the calendar grid."""
    open_days = [h for h in rules.hours if h.open]
    if not open_days:
        return "09:00", "19:00"
    return min(h.opens for h in open_days), max(h.closes for h in open_days)


def _minutes(moment: dt.datetime, day: dt.date) -> int:
    return (moment - local(day, "00:00")) // dt.timedelta(minutes=1)


def load_days(db: Session, dates: list[dt.date], exclude_booking_id: str | None = None) -> list[Day]:
    """Reads the rules, stations, holidays, day changes, bookings and blocks for these dates in a few queries.
    `exclude_booking_id`: leave this booking out (it's the one being moved)."""
    rules = booking_rules(db)
    stations = list_stations(db)
    services = list(db.scalars(select(Service).where(Service.archived.is_(False))))
    closures = {c.date: c for c in db.scalars(select(Closure).where(Closure.date.in_(dates)))}
    changes = {c.date: c for c in db.scalars(select(DayChanges).where(DayChanges.date.in_(dates)))}
    bookings = db.scalars(select(Booking).where(Booking.date.in_(dates), Booking.held.is_not(None), Booking.id != exclude_booking_id))
    blocks = db.scalars(select(TimeBlock).where(TimeBlock.date.in_(dates)))
    openings = db.scalars(select(StationOpening).where(StationOpening.date.in_(dates)))
    opens, closes = opening_span(rules)

    days: dict[dt.date, Day] = {}
    for date in dates:
        hours = rules.hours[date.weekday()]  # Python's weekday(): Monday = 0, like the settings
        closure = closures.get(date)
        day_closed, day_extra = (changes[date].closed, changes[date].extra) if date in changes else ([], [])
        # A holiday silences the weekly extra times after it closes (all of them when it's closed all day).
        weekly_extra = [t for t in hours.extra_starts if not closure or (closure.closes_at and t < closure.closes_at)] if hours.open else []
        if not hours.open or (closure and not closure.closes_at):
            fixed = [(minutes_of_day(opens), minutes_of_day(closes), f"Closed · {closure.name}" if closure else "Closed")]
        else:
            fixed = [(minutes_of_day(hours.break_from), minutes_of_day(hours.break_to), "Break")] if hours.break_from and hours.break_to else []
            if closure and closure.closes_at and closure.closes_at < hours.closes:
                fixed.append((minutes_of_day(closure.closes_at), minutes_of_day(hours.closes), f"Closed · {closure.name}"))
        days[date] = Day(
            date=date, rules=rules, hours=hours, closure=closure,
            # A day's own change wins over the weekly pattern.
            closed=sorted({*hours.closed_starts, *day_closed} - set(day_extra)),
            extra=sorted({*weekly_extra, *day_extra} - set(day_closed)),
            weekly_extra=weekly_extra, stations=stations, services=services, fixed=fixed,
        )
    for b in bookings:
        days[b.date].taken.setdefault(b.station_id, []).append((_minutes(b.held.lower, b.date), _minutes(b.held.upper, b.date)))
    for blk in blocks:
        start = minutes_of_day(blk.time)
        days[blk.date].taken.setdefault(blk.station_id, []).append((start, start + blk.duration_minutes))
        days[blk.date].blocks.setdefault(blk.station_id, []).append((start, start + blk.duration_minutes))
    for o in openings:
        days[o.date].opened[o.station_id] = o.times
    return [days[d] for d in dates]


def load_day(db: Session, date: dt.date, exclude_booking_id: str | None = None) -> Day:
    return load_days(db, [date], exclude_booking_id)[0]


# ── Stations ──


def can_do(st: Station, service: Service) -> bool:
    """Every service, every dog or cat service, or the chosen ones."""
    if st.can_do == "all":
        return True
    if st.can_do == "some":
        return service.id in st.service_ids
    return service.pet_type == ("dog" if st.can_do == "dogs" else "cat")


def free_stations(day: Day, start: int, end: int, ignore_fixed: bool, service: Service | None = None) -> list[Station]:
    """Stations in use that are free from `start` to `end` plus the cleaning buffer. With a service: only the ones that can do it,
    the most specialised first (a cats-only corner before an all-round table), so the all-rounders stay free longest; held-back
    stations come last, so they stay free for when staff need them."""
    buffer = day.rules.buffer_minutes
    fixed = [] if ignore_fixed else [(a, b) for a, b, _ in day.fixed]
    free = [
        st for st in day.stations
        if st.active and (service is None or can_do(st, service))
        and all(end + buffer <= a or start >= b for a, b in day.taken.get(st.id, []) + fixed)
    ]
    if service:
        free.sort(key=lambda st: (st.held_back, sum(can_do(st, s) for s in day.services)))
    return free


def for_customers(day: Day, time: str, stations: list[Station]) -> list[Station]:
    """The ones customers may get at `time`: a held-back station only at the times staff opened for it."""
    return [st for st in stations if not st.held_back or time in day.opened.get(st.id, [])]


def why_busy(day: Day, st: Station, start: int, end: int, ignore_fixed: bool) -> str | None:
    """Why a station can't take a visit from `start` to `end` plus cleaning, in the words the Day tab shows; None if it can."""
    buffer = day.rules.buffer_minutes

    def clash(spans) -> bool:
        return any(not (end + buffer <= a or start >= b) for a, b in spans)

    if clash(day.blocks.get(st.id, [])):
        return "Blocked"
    if clash([span for span in day.taken.get(st.id, []) if span not in day.blocks.get(st.id, [])]):
        return "Booked"
    if not ignore_fixed:
        for a, b, reason in day.fixed:
            if clash([(a, b)]):
                return "Runs into break" if reason == "Break" else "Runs past closing"
    return None


def free_station(day: Day, time: str, service: Service, duration: int, customer: bool = False) -> Station | None:
    """The station a visit starting at `time` would take, or None if that start time can't be booked.
    customer: booked in the customer app, so held-back stations count only at the times opened for them."""
    # Staff opened extra times on purpose, so opening hours, breaks and holidays don't apply to them.
    is_extra = time in day.extra
    start, h = minutes_of_day(time), day.hours
    if not is_extra and (not h.open or start < minutes_of_day(h.opens) or start + duration > minutes_of_day(h.closes)):
        return None
    if starts_at(day.date, time) - now() < dt.timedelta(minutes=day.rules.min_notice_minutes):
        return None
    if day.date > today() + dt.timedelta(days=day.rules.book_ahead_days):
        return None
    stations = free_stations(day, start, start + duration, is_extra, service)
    if time in day.closed:
        stations = [st for st in stations if st.held_back]  # a closed time shuts the usual stations only
    if customer:
        stations = for_customers(day, time, stations)
    return stations[0] if stations else None


def held_range(date: dt.date, time: str, duration: int, buffer: int) -> tuple[dt.datetime, dt.datetime]:
    """The station time a booking holds: from its start until its end plus cleaning."""
    start = local(date, time)
    return start, start + dt.timedelta(minutes=duration + buffer)


# ── Open start times ──


def _usual_starts(day: Day, duration: int) -> list[str]:
    """The usual start times on a date (none when closed all day)."""
    if day.closure and not day.closure.closes_at:
        return []
    return starts_in(day.hours, duration, day.rules.slot_step_minutes)


def open_slots(db: Session, service_id: str, start: dt.date, days: int, exclude_booking_id: str | None = None,
               customer: bool = False) -> list[DayAvailability]:
    """GET /admin/slots: each day's start times for a service (usual ones minus closed, plus extra) and whether a station is free.
    customer: for the customer app (see free_station)."""
    service = db.get(Service, service_id)
    if not service:
        raise HTTPException(status_code=404, detail="Service not found.")
    dates = [start + dt.timedelta(days=i) for i in range(min(days, MAX_DAYS))]
    result = []
    for day in load_days(db, dates, exclude_booking_id):
        starts = sorted({*_usual_starts(day, service.duration_minutes), *day.extra})
        slots = [TimeSlot(time=t, available=free_station(day, t, service, service.duration_minutes, customer) is not None) for t in starts]
        # A closed time is listed only where a held-back station can still take the visit.
        result.append(DayAvailability(date=day.date, slots=[s for s in slots if s.available or s.time not in day.closed]))
    return result


def public_slots(db: Session, service_id: str, date: dt.date) -> list[TimeSlot]:
    """The customer app's start times for one day: only for services the app shows."""
    service = db.get(Service, service_id)
    if not service or not service.visible or service.archived:
        raise HTTPException(status_code=404, detail="Service not found.")
    return open_slots(db, service_id, date, 1, customer=True)[0].slots


# ── The day's slot board (Availability › Day) ──


def slot_board(db: Session, date: dt.date) -> SlotBoardOut:
    day = load_day(db, date)
    step = day.rules.slot_step_minutes
    usual = _usual_starts(day, step)
    # Weekly extra times stay listed when closed for the day, so they can be opened again.
    times = sorted({*usual, *day.extra, *day.weekly_extra})
    free: dict[str, list[Station]] = {}  # per start time: every station free then, held-back ones included, closed or not

    def slot(time: str) -> BoardSlot:
        start = minutes_of_day(time)
        fixed = next((reason for a, b, reason in day.fixed if a <= start < b), None)
        opened = time in day.extra
        # A usual time that's bookable is just "open", even when reopened for the day after a weekly close.
        is_extra = opened and not (time in usual and not fixed)
        blocked = None if is_extra else fixed
        past = starts_at(date, time) < now()
        free[time] = [] if past or blocked else free_stations(day, start, start + step, opened)
        bookable = [st for st in free[time] if st.held_back or time not in day.closed]  # a closed time shuts the usual stations only
        count = len(for_customers(day, time, bookable))
        full_reason = None
        if not (past or blocked or count or time in day.closed):
            # The stations customers could get then, and why none of them can take the visit.
            candidates = for_customers(day, time, [st for st in day.stations if st.active])
            reasons = {why_busy(day, st, start, start + step, opened) for st in candidates} - {None}
            full_reason = ("No station open" if not candidates else "Fully booked" if len(reasons) != 1 or reasons == {"Booked"}
                           else reasons.pop())
        return BoardSlot(
            time=time, state="closed" if time in day.closed else "extra" if is_extra else "open",
            free_stations=count,  # what customers can get; held-back stations only where opened
            full_reason=full_reason,
            blocked_by="Past" if past else blocked,
            weekly="closed" if time in day.hours.closed_starts else "extra" if time in day.hours.extra_starts else None,
        )

    slots = [slot(t) for t in times]
    held_back = [
        HeldBackStation(id=st.id, name=st.name, opened=[t for t in day.opened.get(st.id, []) if t in free],
                        free=[t for t in times if st in free[t]],
                        busy={s.time: why_busy(day, st, minutes_of_day(s.time), minutes_of_day(s.time) + step, s.time in day.extra) or "Busy"
                              for s in slots if not s.blocked_by and st not in free[s.time]})
        for st in day.stations if st.active and st.held_back
    ]
    return SlotBoardOut(
        date=date, hours=day.hours, step_minutes=step, stations=sum(st.active for st in day.stations), slots=slots, held_back=held_back,
        closure=ClosureNote(name=day.closure.name, closes_at=day.closure.closes_at) if day.closure else None,
    )


def set_slot(db: Session, date: dt.date, time: str, open: bool) -> SlotBoardOut:
    """Open or close one start time on one day. Closing stops new bookings starting then; bookings already made stay."""
    if not TIME.match(time):
        raise HTTPException(status_code=400, detail="Enter a time like 18:30.")
    rules = booking_rules(db)
    if date > today() + dt.timedelta(days=rules.book_ahead_days):
        raise HTTPException(status_code=400, detail=f"Bookings open {rules.book_ahead_days} days ahead; change this day nearer the time.")
    if starts_at(date, time) < now():
        raise HTTPException(status_code=400, detail="That time has passed.")
    changes = db.get(DayChanges, date) or DayChanges(date=date, closed=[], extra=[])
    db.add(changes)

    def is_open() -> bool:
        db.flush()  # so the board below sees the change just made
        return any(s.time == time and s.state != "closed" and not s.blocked_by for s in slot_board(db, date).slots)

    if open:
        # Undo a close for the day; if it's still shut (closed every week, in the break, after hours), open it for the day.
        changes.closed = [t for t in changes.closed if t != time]
        if not is_open():
            changes.extra = sorted({*changes.extra, time})
    else:
        if not is_open():
            raise HTTPException(status_code=404, detail="That isn't an open start time on this day.")
        changes.extra = [t for t in changes.extra if t != time]
        if is_open():
            changes.closed = sorted({*changes.closed, time})
    if not changes.closed and not changes.extra:
        db.delete(changes)  # nothing changed on this day any more
    db.commit()
    return slot_board(db, date)


def open_station_time(db: Session, date: dt.date, station_id: str, time: str, open: bool) -> SlotBoardOut:
    """Open one start time of a held-back station to customers on one date, or hold it back again.
    It must be one of the day's start times (not in the break or after a holiday's closing, unless opened as an extra time), but
    closing that time for the usual stations doesn't matter. Bookings, blocks, buffer and notice still apply."""
    st = db.get(Station, station_id)
    if not st:
        raise HTTPException(status_code=404, detail="Station not found.")
    if not st.held_back:
        raise HTTPException(status_code=400, detail=f"Customers can always book {st.name}. Hold it back in Stations first.")
    if not TIME.match(time):
        raise HTTPException(status_code=400, detail="Enter a time like 18:30.")
    if starts_at(date, time) < now():
        raise HTTPException(status_code=400, detail="That time has passed.")
    if open and not any(s.time == time and not s.blocked_by for s in slot_board(db, date).slots):
        raise HTTPException(status_code=404, detail="That isn't a start time on this day.")
    row = db.get(StationOpening, (station_id, date))
    times = sorted({*(row.times if row else []), time} if open else {t for t in (row.times if row else []) if t != time})
    if times:
        row = row or StationOpening(station_id=station_id, date=date)
        row.times = times
        db.add(row)
    elif row:
        db.delete(row)  # nothing opened on this day any more
    db.commit()
    return slot_board(db, date)


# ── Block time (Bookings › calendar) ──


def blocks_on(day: Day, staff_blocks: list[TimeBlock]) -> list[TimeBlockOut]:
    """Breaks and holiday closing on every station (fixed), plus the blocks staff added."""
    fixed = [
        TimeBlockOut(id=f"{'break' if reason == 'Break' else 'closed'}-{day.date}-{st.id}", station_id=st.id, date=day.date,
                     time=time_from_minutes(a), duration_minutes=b - a, reason=reason, fixed=True)
        for a, b, reason in day.fixed for st in day.stations
    ]
    return fixed + [TimeBlockOut.model_validate(blk) for blk in staff_blocks]


def add_block(db: Session, body: TimeBlockIn) -> TimeBlockOut:
    if not db.get(Station, body.station_id):
        raise HTTPException(status_code=400, detail="Pick a station.")
    day = load_day(db, body.date)
    time, duration, reason = body.time, body.duration_minutes, body.reason or "Blocked"
    if body.all_day:
        # A day off for one station: opening to closing.
        if not day.hours.open:
            raise HTTPException(status_code=400, detail="The shop is closed that day.")
        time, reason = day.hours.opens, body.reason or "Day off"
        duration = minutes_of_day(day.hours.closes) - minutes_of_day(day.hours.opens)
    if duration < 15:
        raise HTTPException(status_code=400, detail="Block at least 15 minutes.")
    start = minutes_of_day(time)
    # Only bookings and other blocks clash; running over the break or a holiday is harmless.
    if any(start < b and a < start + duration for a, b in day.taken.get(body.station_id, [])):
        raise HTTPException(status_code=409, detail="That time overlaps a booking or another block on this station.")
    block = TimeBlock(station_id=body.station_id, date=body.date, time=time, duration_minutes=duration, reason=reason[:80])
    db.add(block)
    db.commit()
    return TimeBlockOut.model_validate(block)


def remove_block(db: Session, block_id: str) -> None:
    block = db.get(TimeBlock, block_id)
    if not block:
        raise HTTPException(status_code=404, detail="That block can't be removed.")
    db.delete(block)
    db.commit()
