"""Bookings (/admin/bookings) and the calendar (/admin/calendar). Every signed-in staff member takes bookings."""

import datetime as dt
from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dates import today
from app.core.schemas import Paged
from app.grooming.bookings import service
from app.grooming.bookings.schemas import (
    BookingBill, BookingDetailsIn, BookingOut, CalendarOut, CancelIn, NoteIn, PaymentLinkIn, QuoteIn, RescheduleIn, ShopPaymentIn,
)
from app.shared.staff.models import StaffUser
from app.shared.staff.service import current_staff

router = APIRouter(prefix="/admin/bookings", tags=["bookings"])
calendar_router = APIRouter(prefix="/admin/calendar", tags=["bookings"])


@router.get("", response_model=Paged[BookingOut])
def bookings(
    stage: str = "",
    customer_id: str | None = Query(default=None, alias="customerId"),
    period: Literal["any", "today", "next7", "last30"] = Query(default="any", alias="range"),
    service_id: str | None = Query(default=None, alias="serviceId"),
    pet_type: Literal["dog", "cat"] | None = Query(default=None, alias="petType"),
    payment_status: str | None = Query(default=None, alias="paymentStatus"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=10_000, alias="pageSize"),
    db: Session = Depends(get_db),
    _: StaffUser = Depends(current_staff),
) -> Paged[BookingOut]:
    """Filters and one page: /admin/bookings?stage=confirmed,awaiting_payment&range=next7&page=1"""
    stages = [s for s in stage.split(",") if s]
    return service.list_bookings(db, stages, customer_id, period, service_id, pet_type, payment_status, page, page_size)


# Fixed paths before /{booking_id}.
@router.get("/counts")
def counts(db: Session = Depends(get_db), _: StaffUser = Depends(current_staff)) -> dict[str, int]:
    return service.stage_counts(db)


@router.post("/quote", response_model=BookingBill)
def quote(body: QuoteIn, db: Session = Depends(get_db), _: StaffUser = Depends(current_staff)) -> BookingBill:
    return service.quote(db, body)


@router.get("/{booking_id}", response_model=BookingOut)
def booking(booking_id: str, db: Session = Depends(get_db), _: StaffUser = Depends(current_staff)) -> BookingOut:
    return service.booking_out(service.find_booking(db, booking_id))


@router.post("", response_model=BookingOut)
def start_booking(body: BookingDetailsIn, db: Session = Depends(get_db), me: StaffUser = Depends(current_staff)) -> BookingOut:
    """A new draft (staff on a phone call)."""
    return service.save_details(db, None, body, me.name)


@router.put("/{booking_id}", response_model=BookingOut)
def edit_draft(booking_id: str, body: BookingDetailsIn, db: Session = Depends(get_db), me: StaffUser = Depends(current_staff)) -> BookingOut:
    return service.save_details(db, booking_id, body, me.name)


@router.post("/{booking_id}/confirm", response_model=BookingOut)
def confirm(booking_id: str, db: Session = Depends(get_db), me: StaffUser = Depends(current_staff)) -> BookingOut:
    return service.confirm(db, service.find_booking(db, booking_id), me.name)


@router.post("/{booking_id}/reschedule", response_model=BookingOut)
def reschedule(booking_id: str, body: RescheduleIn, db: Session = Depends(get_db), me: StaffUser = Depends(current_staff)) -> BookingOut:
    return service.reschedule(db, service.find_booking(db, booking_id), body.date, body.time, me.name)


@router.post("/{booking_id}/cancel", response_model=BookingOut)
def cancel(booking_id: str, body: CancelIn, db: Session = Depends(get_db), me: StaffUser = Depends(current_staff)) -> BookingOut:
    return service.cancel(db, service.find_booking(db, booking_id), body.reason, me.name)


@router.post("/{booking_id}/complete", response_model=BookingOut)
def complete(booking_id: str, db: Session = Depends(get_db), me: StaffUser = Depends(current_staff)) -> BookingOut:
    return service.close_visit(db, service.find_booking(db, booking_id), "completed", me.name)


@router.post("/{booking_id}/no-show", response_model=BookingOut)
def no_show(booking_id: str, db: Session = Depends(get_db), me: StaffUser = Depends(current_staff)) -> BookingOut:
    return service.close_visit(db, service.find_booking(db, booking_id), "no_show", me.name)


@router.post("/{booking_id}/payment-link", response_model=BookingOut)
def payment_link(booking_id: str, body: PaymentLinkIn, db: Session = Depends(get_db), me: StaffUser = Depends(current_staff)) -> BookingOut:
    return service.payment_link(db, service.find_booking(db, booking_id), body.amount_type, me.name)


@router.post("/{booking_id}/payments", response_model=BookingOut)
def take_payment(booking_id: str, body: ShopPaymentIn, db: Session = Depends(get_db), me: StaffUser = Depends(current_staff)) -> BookingOut:
    """Money taken at the shop; with complete=true it's checkout (paid and completed in one step)."""
    return service.record_payment(db, service.find_booking(db, booking_id), body, me.name)


@router.post("/{booking_id}/demo-pay", response_model=BookingOut)
def demo_pay(booking_id: str, db: Session = Depends(get_db), _: StaffUser = Depends(current_staff)) -> BookingOut:
    """Until the payment gateway is connected (Module 12): pretend the customer paid the open link."""
    return service.pay_link(db, service.find_booking(db, booking_id))


@router.post("/{booking_id}/notes", response_model=BookingOut)
def add_note(booking_id: str, body: NoteIn, db: Session = Depends(get_db), me: StaffUser = Depends(current_staff)) -> BookingOut:
    return service.add_note(db, service.find_booking(db, booking_id), body.text, me.name)


@calendar_router.get("", response_model=CalendarOut)
def calendar(
    start: dt.date | None = Query(default=None, alias="from"),
    days: int = Query(default=1, ge=1, le=14),
    db: Session = Depends(get_db),
    _: StaffUser = Depends(current_staff),
) -> CalendarOut:
    return service.calendar(db, start or today(), days)
