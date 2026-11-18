"""Payments (/admin/payments) and a customer's Payments tab (/admin/customers/{id}/payments). Everyone sees them; only the
Super Admin refunds."""

import datetime as dt
from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.schemas import Paged
from app.grooming.money import service
from app.grooming.money.schemas import PaymentRow, PaymentSummary
from app.shared.customers.service import find_customer
from app.shared.staff.models import StaffUser
from app.shared.staff.service import OWNER_ROLES, current_staff, require_roles

router = APIRouter(prefix="/admin/payments", tags=["payments"])
customer_router = APIRouter(prefix="/admin/customers", tags=["customers"])


@router.get("", response_model=Paged[PaymentRow])
def payments(
    tab: Literal["all", "due", "waiting", "paid", "failed", "refunded"] = "all",
    start: dt.date | None = Query(default=None, alias="from"),
    end: dt.date | None = Query(default=None, alias="to"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=10_000, alias="pageSize"),  # large pages are for the CSV export
    db: Session = Depends(get_db),
    _: StaffUser = Depends(current_staff),
) -> Paged[PaymentRow]:
    return service.list_payments(db, tab, start, end, page, page_size)


@router.get("/summary", response_model=PaymentSummary)
def summary(
    start: dt.date | None = Query(default=None, alias="from"),
    end: dt.date | None = Query(default=None, alias="to"),
    db: Session = Depends(get_db),
    _: StaffUser = Depends(current_staff),
) -> PaymentSummary:
    return service.summary(db, start, end)


@router.post("/{payment_id}/refund", response_model=PaymentRow)
def refund(payment_id: str, db: Session = Depends(get_db), me: StaffUser = Depends(require_roles(*OWNER_ROLES))) -> PaymentRow:
    return service.refund(db, payment_id, me.name)


@customer_router.get("/{customer_id}/payments", response_model=list[PaymentRow])
def customer_payments(customer_id: str, db: Session = Depends(get_db), _: StaffUser = Depends(current_staff)) -> list[PaymentRow]:
    """The Payments tab on a customer's profile: everything, newest first."""
    return service.payment_rows(db, customer_id=find_customer(db, customer_id).id)
