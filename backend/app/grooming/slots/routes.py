"""Open start times (/admin/slots), the day's slot board (/admin/slot-board) and block time (/admin/blocks).
Day-to-day running, so every signed-in staff member can use them. (The usual week, /admin/slot-board/week, is in settings.)"""

import datetime as dt

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dates import today
from app.grooming.slots import service
from app.grooming.slots.schemas import DayAvailability, SlotBoardOut, TimeBlockIn, TimeBlockOut, TimeSlot
from app.shared.settings.schemas import WeekSlotIn
from app.shared.staff.models import StaffUser
from app.shared.staff.service import SETTINGS_ROLES, current_staff, require_roles

slots_router = APIRouter(prefix="/admin/slots", tags=["availability"])
board_router = APIRouter(prefix="/admin/slot-board", tags=["availability"])
blocks_router = APIRouter(prefix="/admin/blocks", tags=["availability"])
public_router = APIRouter(prefix="/slots", tags=["customer app"])


@slots_router.get("", response_model=list[DayAvailability])
def slots(
    service_id: str = Query(alias="serviceId"),
    start: dt.date | None = Query(default=None, alias="from"),
    days: int = Query(default=7, ge=1, le=service.MAX_DAYS),
    exclude_booking_id: str | None = Query(default=None, alias="excludeBookingId"),
    db: Session = Depends(get_db),
    _: StaffUser = Depends(current_staff),
) -> list[DayAvailability]:
    """Start times for a service, day by day: /admin/slots?serviceId=dog-signature-bath&from=2026-11-20&days=7.
    excludeBookingId leaves out the booking being moved, so its own time shows as free."""
    return service.open_slots(db, service_id, start or today(), days, exclude_booking_id)


@board_router.get("", response_model=SlotBoardOut)
def board(date: dt.date | None = None, db: Session = Depends(get_db), _: StaffUser = Depends(current_staff)) -> SlotBoardOut:
    return service.slot_board(db, date or today())


@board_router.put("/{date}", response_model=SlotBoardOut)
def set_slot(date: dt.date, body: WeekSlotIn, db: Session = Depends(get_db), _: StaffUser = Depends(current_staff)) -> SlotBoardOut:
    return service.set_slot(db, date, body.time, body.open)


@board_router.put("/{date}/stations/{station_id}", response_model=SlotBoardOut)
def open_station_time(
    date: dt.date, station_id: str, body: WeekSlotIn, db: Session = Depends(get_db), _: StaffUser = Depends(require_roles(*SETTINGS_ROLES)),
) -> SlotBoardOut:
    """Open a held-back station's start time to customers, or hold it back again (Admin and Super Admin)."""
    return service.open_station_time(db, date, station_id, body.time, body.open)


@blocks_router.post("", response_model=TimeBlockOut)
def add_block(body: TimeBlockIn, db: Session = Depends(get_db), _: StaffUser = Depends(current_staff)) -> TimeBlockOut:
    return service.add_block(db, body)


@blocks_router.delete("/{block_id}", status_code=204)
def remove_block(block_id: str, db: Session = Depends(get_db), _: StaffUser = Depends(current_staff)) -> Response:
    service.remove_block(db, block_id)
    return Response(status_code=204)


@public_router.get("", response_model=list[TimeSlot])
def public_slots(date: dt.date, service_id: str = Query(alias="serviceId"), db: Session = Depends(get_db)) -> list[TimeSlot]:
    """One day's start times for a service the app shows (no login needed): /slots?date=2026-11-20&serviceId=dog-signature-bath"""
    return service.public_slots(db, service_id, date)
