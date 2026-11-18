"""Customers (/admin/customers) and pets (/admin/pets). Day-to-day work, so every signed-in staff member can use them.

A customer's Payments and Activity tabs (/admin/customers/{id}/payments, /activity) come from bookings and payments,
so they arrive with those modules (5 and 6).
"""

from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.schemas import Paged
from app.shared.customers import service
from app.shared.customers.models import Pet
from app.shared.customers.schemas import (
    CustomerIn, CustomerOut, CustomerSummaryOut, NoteIn, PetCounts, PetIn, PetOut, PetRecordOut, PetSummaryOut, Segment,
)
from app.shared.staff.models import StaffUser
from app.shared.staff.service import current_staff

router = APIRouter(prefix="/admin/customers", tags=["customers"])
pet_router = APIRouter(prefix="/admin/pets", tags=["pets"])


@router.get("", response_model=Paged[CustomerSummaryOut])
def customers(
    q: str = "",
    segment: Segment = "all",
    plan: str = "",
    pet_type: Literal["dog", "cat"] | None = Query(default=None, alias="petType"),
    sort: Literal["last_visit", "name", "spent"] = "last_visit",
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100, alias="pageSize"),
    db: Session = Depends(get_db),
    _: StaffUser = Depends(current_staff),
) -> Paged[CustomerSummaryOut]:
    """Search, tab, filters and one page: /admin/customers?q=coco&segment=new&page=2&pageSize=10"""
    return service.list_customers(db, q, segment, plan, pet_type, sort, page, page_size)


# Fixed paths before /{customer_id}, or "counts" would be read as a customer id.
@router.get("/counts")
def counts(db: Session = Depends(get_db), _: StaffUser = Depends(current_staff)) -> dict[str, int]:
    return service.segment_counts(db)


@router.get("/lookup", response_model=CustomerOut | None)
def lookup(phone: str, db: Session = Depends(get_db), _: StaffUser = Depends(current_staff)) -> CustomerOut | None:
    """The customer with this mobile number, or null (New booking checks before adding someone)."""
    c = service.find_by_phone(db, phone)
    return service.customer_out(c) if c else None


@router.post("", response_model=CustomerOut)
def add_customer(body: CustomerIn, db: Session = Depends(get_db), _: StaffUser = Depends(current_staff)) -> CustomerOut:
    return service.create_customer(db, body)


@router.get("/{customer_id}", response_model=CustomerOut)
def customer(customer_id: str, db: Session = Depends(get_db), _: StaffUser = Depends(current_staff)) -> CustomerOut:
    return service.customer_out(service.find_customer(db, customer_id))


@router.put("/{customer_id}", response_model=CustomerOut)
def edit_customer(customer_id: str, body: CustomerIn, db: Session = Depends(get_db), _: StaffUser = Depends(current_staff)) -> CustomerOut:
    return service.update_customer(db, service.find_customer(db, customer_id), body)


@router.put("/{customer_id}/note", response_model=CustomerOut)
def note(customer_id: str, body: NoteIn, db: Session = Depends(get_db), me: StaffUser = Depends(current_staff)) -> CustomerOut:
    return service.save_note(db, service.find_customer(db, customer_id), body, me.name)


@router.post("/{customer_id}/pets", response_model=PetOut)
def add_pet(customer_id: str, body: PetIn, db: Session = Depends(get_db), _: StaffUser = Depends(current_staff)) -> Pet:
    return service.add_pet(db, service.find_customer(db, customer_id), body)


@pet_router.get("", response_model=Paged[PetSummaryOut])
def pets(
    q: str = "",
    type: Literal["dog", "cat"] | None = None,
    vaccination_due: bool = Query(default=False, alias="vaccinationDue"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100, alias="pageSize"),
    db: Session = Depends(get_db),
    _: StaffUser = Depends(current_staff),
) -> Paged[PetSummaryOut]:
    return service.list_pets(db, q, type, vaccination_due, page, page_size)


@pet_router.get("/counts", response_model=PetCounts)
def pet_counts(db: Session = Depends(get_db), _: StaffUser = Depends(current_staff)) -> PetCounts:
    return service.pet_counts(db)


@pet_router.get("/{pet_id}", response_model=PetRecordOut)
def pet(pet_id: str, db: Session = Depends(get_db), _: StaffUser = Depends(current_staff)) -> PetRecordOut:
    return service.pet_record(service.find_pet(db, pet_id))


@pet_router.put("/{pet_id}", response_model=PetOut)
def edit_pet(pet_id: str, body: PetIn, db: Session = Depends(get_db), _: StaffUser = Depends(current_staff)) -> Pet:
    return service.update_pet(db, service.find_pet(db, pet_id), body)
