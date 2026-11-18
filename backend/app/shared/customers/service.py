"""Customers and pets: search, tabs and pages, one customer per mobile number, the staff note."""

import datetime as dt
import re

from fastapi import HTTPException
from sqlalchemy import ColumnElement, false, func, or_, select, true
from sqlalchemy.orm import Session, selectinload

from app.core.dates import now
from app.core.schemas import Paged
from app.shared.customers.models import Customer, Pet
from app.shared.customers.schemas import (
    CustomerIn, CustomerOut, CustomerSummaryOut, NoteIn, PetCounts, PetIn, PetOwner, PetOut, PetRecordOut, PetSummaryOut, StaffNote,
    phone_digits,
)

SEGMENTS = ("all", "members", "new", "lapsed", "no_plan")

# ── Customers ──


def customer_out(c: Customer) -> CustomerOut:
    note = StaffNote(text=c.note_text, by=c.note_by or "", at=c.note_at) if c.note_text and c.note_at else None
    return CustomerOut.model_validate(c).model_copy(update={"staff_note": note})


def summary_out(c: Customer) -> CustomerSummaryOut:
    return CustomerSummaryOut(id=c.id, name=c.name, phone=c.phone, pet_names=[p.name for p in c.pets])


def _matches(q: str) -> ColumnElement[bool]:
    """Search: the customer's or a pet's name contains the text, or the phone contains 3+ digits typed.
    pets.any(...) asks the database "does this customer have a pet whose name matches?" (EXISTS in SQL)."""
    found = [Customer.name.icontains(q, autoescape=True), Customer.pets.any(Pet.name.icontains(q, autoescape=True))]
    digits = re.sub(r"\D", "", q)
    if len(digits) >= 3:
        found.append(Customer.phone.contains(digits))
    return or_(*found)


def _in_segment(segment: str) -> ColumnElement[bool]:
    """The tabs on the Customers page. Members and lapsed customers are worked out from memberships and visits, which come
    with Modules 5 and 7; until then nobody is a member or lapsed, and everyone has no plan."""
    if segment == "new":
        start_of_month = now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        return Customer.customer_since >= start_of_month
    if segment in ("members", "lapsed"):
        return false()
    return true()  # all, no_plan


def list_customers(db: Session, q: str, segment: str, plan: str, pet_type: str | None, sort: str, page: int, page_size: int) -> Paged[CustomerSummaryOut]:
    query = select(Customer).where(_in_segment(segment))
    if q.strip():
        query = query.where(_matches(q.strip()))
    if pet_type:
        query = query.where(Customer.pets.any(Pet.type == pet_type))
    if plan and plan != "none":
        query = query.where(false())  # nobody is on a plan until memberships are in the backend (Module 7)
    total = db.scalar(select(func.count()).select_from(query.subquery()))
    # Sorting by last visit or money spent needs bookings (Modules 5–6); until then those sorts show the newest customers first.
    order = [Customer.name] if sort == "name" else [Customer.customer_since.desc()]
    rows = db.scalars(
        query.order_by(*order, Customer.id)
        .offset((page - 1) * page_size)  # skip the earlier pages
        .limit(page_size)
        .options(selectinload(Customer.pets))  # every row's pets in one extra query, not one query per row
    )
    return Paged(items=[summary_out(c) for c in rows], total=total, page=page, page_size=page_size)


def segment_counts(db: Session) -> dict[str, int]:
    return {s: db.scalar(select(func.count()).select_from(Customer).where(_in_segment(s))) for s in SEGMENTS}


def find_customer(db: Session, customer_id: str) -> Customer:
    c = db.get(Customer, customer_id)
    if not c:
        raise HTTPException(status_code=404, detail="Customer not found.")
    return c


def find_by_phone(db: Session, phone: str) -> Customer | None:
    return db.scalar(select(Customer).where(Customer.phone == phone_digits(phone)))


def _number_taken(db: Session, phone: str, customer_id: str | None = None) -> bool:
    return db.scalar(select(Customer.id).where(Customer.phone == phone, Customer.id != customer_id)) is not None


def create_customer(db: Session, body: CustomerIn) -> CustomerOut:
    if _number_taken(db, body.phone):
        raise HTTPException(status_code=409, detail="A customer with this number already exists.")
    c = Customer(**body.model_dump())
    db.add(c)
    db.commit()
    return customer_out(c)


def update_customer(db: Session, c: Customer, body: CustomerIn) -> CustomerOut:
    """Bookings keep their own copy of the name and phone; Module 5 keeps those in step."""
    if _number_taken(db, body.phone, c.id):
        raise HTTPException(status_code=409, detail="Another customer already has this number.")
    for field, value in body.model_dump().items():
        setattr(c, field, value)
    db.commit()
    return customer_out(c)


def save_note(db: Session, c: Customer, body: NoteIn, by: str) -> CustomerOut:
    text = body.text.strip()
    c.note_text, c.note_by, c.note_at = (text, by, dt.datetime.now(dt.timezone.utc)) if text else (None, None, None)
    db.commit()
    return customer_out(c)


# ── Pets ──


def _pet_summary(p: Pet) -> PetSummaryOut:
    return PetSummaryOut(pet=PetOut.model_validate(p), owner=PetOwner.model_validate(p.owner))


def add_pet(db: Session, c: Customer, body: PetIn) -> Pet:
    pet = Pet(customer_id=c.id, **body.model_dump())
    db.add(pet)
    db.commit()
    return pet


def list_pets(db: Session, q: str, pet_type: str | None, vaccination_due: bool, page: int, page_size: int) -> Paged[PetSummaryOut]:
    # join: each pet row together with its owner's row, so the search can look at the owner's name too.
    query = select(Pet).join(Pet.owner)
    if q.strip():
        text = q.strip()
        query = query.where(or_(Pet.name.icontains(text, autoescape=True), Pet.breed.icontains(text, autoescape=True),
                                Customer.name.icontains(text, autoescape=True)))
    if pet_type:
        query = query.where(Pet.type == pet_type)
    if vaccination_due:
        query = query.where(Pet.vaccination.in_(("due_soon", "not_vaccinated")))
    total = db.scalar(select(func.count()).select_from(query.subquery()))
    rows = db.scalars(query.order_by(Pet.name, Pet.id).offset((page - 1) * page_size).limit(page_size).options(selectinload(Pet.owner)))
    return Paged(items=[_pet_summary(p) for p in rows], total=total, page=page, page_size=page_size)


def pet_counts(db: Session) -> PetCounts:
    by_type = dict(db.execute(select(Pet.type, func.count()).group_by(Pet.type)).all())
    return PetCounts(all=sum(by_type.values()), dog=by_type.get("dog", 0), cat=by_type.get("cat", 0))


def find_pet(db: Session, pet_id: str) -> Pet:
    pet = db.get(Pet, pet_id)
    if not pet:
        raise HTTPException(status_code=404, detail="Pet not found.")
    return pet


def pet_record(pet: Pet) -> PetRecordOut:
    return PetRecordOut(pet=PetOut.model_validate(pet), owner=PetOwner.model_validate(pet.owner))


def update_pet(db: Session, pet: Pet, body: PetIn) -> Pet:
    """Bookings keep their own copy of the pet's name and breed; Module 5 keeps those in step."""
    for field, value in body.model_dump().items():
        setattr(pet, field, value)
    db.commit()
    return pet
