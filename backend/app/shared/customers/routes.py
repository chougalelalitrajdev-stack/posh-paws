"""Customers (/admin/customers) and pets (/admin/pets). Day-to-day work, so every signed-in staff member can use them.

A customer's Payments tab (/admin/customers/{id}/payments) is with the Payments page (grooming/money). The top-bar search
(/admin/search) is here too: customers, pets and booking IDs.
"""

from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.schemas import Paged
from app.shared.customers import overview, service
from app.shared.customers.overview import ActivityEntry
from app.shared.customers.models import Pet
from app.shared.customers.schemas import (
    AppPetIn, AppPetOut, CustomerIn, CustomerOut, CustomerSummaryOut, NoteIn, PetCounts, PetIn, PetOut, PetRecordOut, PetSummaryOut, SearchResults, Segment,
)
from app.shared.customer_login.service import current_customer
from app.shared.customers.models import Customer
from app.shared.staff.models import StaffUser
from app.shared.staff.service import current_staff

router = APIRouter(prefix="/admin/customers", tags=["customers"])
pet_router = APIRouter(prefix="/admin/pets", tags=["pets"])
search_router = APIRouter(prefix="/admin/search", tags=["search"])
my_pets_router = APIRouter(prefix="/pets", tags=["customer app"])


@router.get("", response_model=Paged[CustomerSummaryOut])
def customers(
    q: str = "",
    segment: Segment = "all",
    plan: str = "",
    pet_type: Literal["dog", "cat"] | None = Query(default=None, alias="petType"),
    sort: Literal["last_visit", "name", "spent"] = "last_visit",
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=10_000, alias="pageSize"),
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
    return service.customer_out(db, c) if c else None


@router.post("", response_model=CustomerOut)
def add_customer(body: CustomerIn, db: Session = Depends(get_db), _: StaffUser = Depends(current_staff)) -> CustomerOut:
    return service.create_customer(db, body)


@router.get("/{customer_id}", response_model=CustomerOut)
def customer(customer_id: str, db: Session = Depends(get_db), _: StaffUser = Depends(current_staff)) -> CustomerOut:
    return service.customer_out(db, service.find_customer(db, customer_id))


@router.put("/{customer_id}", response_model=CustomerOut)
def edit_customer(customer_id: str, body: CustomerIn, db: Session = Depends(get_db), _: StaffUser = Depends(current_staff)) -> CustomerOut:
    return service.update_customer(db, service.find_customer(db, customer_id), body)


@router.put("/{customer_id}/note", response_model=CustomerOut)
def note(customer_id: str, body: NoteIn, db: Session = Depends(get_db), me: StaffUser = Depends(current_staff)) -> CustomerOut:
    return service.save_note(db, service.find_customer(db, customer_id), body, me.name)


@router.get("/{customer_id}/activity", response_model=list[ActivityEntry])
def customer_activity(customer_id: str, db: Session = Depends(get_db), _: StaffUser = Depends(current_staff)) -> list[ActivityEntry]:
    """The Activity tab: their bookings' history, plan changes and when they joined, newest first."""
    return overview.activity(db, service.find_customer(db, customer_id))


@router.post("/{customer_id}/pets", response_model=PetOut)
def add_pet(customer_id: str, body: PetIn, db: Session = Depends(get_db), _: StaffUser = Depends(current_staff)) -> Pet:
    return service.add_pet(db, service.find_customer(db, customer_id), body)


@pet_router.get("", response_model=Paged[PetSummaryOut])
def pets(
    q: str = "",
    type: Literal["dog", "cat"] | None = None,
    vaccination_due: bool = Query(default=False, alias="vaccinationDue"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=10_000, alias="pageSize"),
    db: Session = Depends(get_db),
    _: StaffUser = Depends(current_staff),
) -> Paged[PetSummaryOut]:
    return service.list_pets(db, q, type, vaccination_due, page, page_size)


@pet_router.get("/counts", response_model=PetCounts)
def pet_counts(db: Session = Depends(get_db), _: StaffUser = Depends(current_staff)) -> PetCounts:
    return service.pet_counts(db)


@pet_router.get("/{pet_id}", response_model=PetRecordOut)
def pet(pet_id: str, db: Session = Depends(get_db), _: StaffUser = Depends(current_staff)) -> PetRecordOut:
    return service.pet_record(db, service.find_pet(db, pet_id))


@pet_router.put("/{pet_id}", response_model=PetOut)
def edit_pet(pet_id: str, body: PetIn, db: Session = Depends(get_db), _: StaffUser = Depends(current_staff)) -> Pet:
    return service.update_pet(db, service.find_pet(db, pet_id), body)


@search_router.get("", response_model=SearchResults)
def search(q: str = "", db: Session = Depends(get_db), _: StaffUser = Depends(current_staff)) -> SearchResults:
    return overview.search(db, q)


# ── The customer app: the logged-in customer's own pets ──


@my_pets_router.get("", response_model=list[AppPetOut])
def my_pets(db: Session = Depends(get_db), me: Customer = Depends(current_customer)) -> list[AppPetOut]:
    return service.my_pets(db, me)


@my_pets_router.post("", response_model=AppPetOut)
def add_my_pet(body: AppPetIn, db: Session = Depends(get_db), me: Customer = Depends(current_customer)) -> AppPetOut:
    return service.add_my_pet(db, me, body)


@my_pets_router.put("/{pet_id}", response_model=AppPetOut)
def edit_my_pet(pet_id: str, body: AppPetIn, db: Session = Depends(get_db), me: Customer = Depends(current_customer)) -> AppPetOut:
    return service.update_my_pet(db, service.my_pet(db, me, pet_id), body)
