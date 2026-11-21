"""Customers and pets: search, tabs and pages, one customer per mobile number, the staff note, and the breed list.
Their numbers (visits, money, membership) come from overview.py. A marked exception: changing a pet's breed, weight or coat
asks grooming to re-price that pet's upcoming bookings (reprice_pet below)."""

import datetime as dt
import re

from fastapi import HTTPException
from sqlalchemy import ColumnElement, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.core.schemas import Paged
from app.shared.customers import overview
from app.shared.customers.models import Breed, Customer, Pet
from app.shared.customers.schemas import (
    AppPetIn, AppPetOut, BreedOut, CustomerIn, CustomerOut, CustomerSummaryOut, NoteIn, PetCounts, PetIn, PetOwner, PetOut, PetRecordOut, PetSummaryOut,
    PricedPetIn, StaffNote, phone_digits,
)
from app.shared.customers.overview import in_segment, on_plan, sort_order

SEGMENTS = ("all", "members", "new", "lapsed", "no_plan")

# ── Customers ──


def customer_out(db: Session, c: Customer) -> CustomerOut:
    note = StaffNote(text=c.note_text, by=c.note_by or "", at=c.note_at) if c.note_text and c.note_at else None
    return CustomerOut.model_validate(c).model_copy(update={"staff_note": note, **overview.profile_numbers(db, c)})


def _matches(q: str) -> ColumnElement[bool]:
    """Search: the customer's or a pet's name contains the text, or the phone contains 3+ digits typed.
    pets.any(...) asks the database "does this customer have a pet whose name matches?" (EXISTS in SQL)."""
    found = [Customer.name.icontains(q, autoescape=True), Customer.pets.any(Pet.name.icontains(q, autoescape=True))]
    digits = re.sub(r"\D", "", q)
    if len(digits) >= 3:
        found.append(Customer.phone.contains(digits))
    return or_(*found)


def list_customers(db: Session, q: str, segment: str, plan: str, pet_type: str | None, sort: str, page: int, page_size: int) -> Paged[CustomerSummaryOut]:
    query = select(Customer).where(in_segment(segment))
    if q.strip():
        query = query.where(_matches(q.strip()))
    if pet_type:
        query = query.where(Customer.pets.any(Pet.type == pet_type))
    if plan:
        query = query.where(on_plan(plan))
    total = db.scalar(select(func.count()).select_from(query.subquery()))
    rows = db.scalars(
        query.order_by(*sort_order(sort), Customer.id)
        .offset((page - 1) * page_size)  # skip the earlier pages
        .limit(page_size)
        .options(selectinload(Customer.pets))  # every row's pets in one extra query, not one query per row
    )
    return Paged(items=overview.summaries(db, list(rows)), total=total, page=page, page_size=page_size)


def segment_counts(db: Session) -> dict[str, int]:
    return {s: db.scalar(select(func.count()).select_from(Customer).where(in_segment(s))) for s in SEGMENTS}


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
    return customer_out(db, c)


def update_customer(db: Session, c: Customer, body: CustomerIn) -> CustomerOut:
    """Bookings read the customer's record, so they show the new details too."""
    if _number_taken(db, body.phone, c.id):
        raise HTTPException(status_code=409, detail="Another customer already has this number.")
    for field, value in body.model_dump().items():
        setattr(c, field, value)
    db.commit()
    return customer_out(db, c)


def save_note(db: Session, c: Customer, body: NoteIn, by: str) -> CustomerOut:
    text = body.text.strip()
    c.note_text, c.note_by, c.note_at = (text, by, dt.datetime.now(dt.timezone.utc)) if text else (None, None, None)
    db.commit()
    return customer_out(db, c)


# ── Breeds ──

# A fresh shop starts with these (Catalog › Pet pricing changes them). Indie first and Other last, so everyone finds a fit.
STARTER_BREEDS = {
    "dog": ["Indie", "Beagle", "Boxer", "Cocker Spaniel", "Dachshund", "Dobermann", "French Bulldog", "German Shepherd", "Golden Retriever",
            "Husky", "Labrador", "Lhasa Apso", "Maltese", "Pomeranian", "Poodle", "Pug", "Rottweiler", "Shih Tzu", "Yorkshire Terrier", "Other"],
    "cat": ["Indie", "Bengal", "British Shorthair", "Maine Coon", "Persian", "Ragdoll", "Siamese", "Siberian", "Other"],
}


def starter_id(pet_type: str, name: str) -> str:
    """dog-german-shepherd: readable ids for the starter breeds."""
    return f"{pet_type}-{re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')}"


def list_breeds(db: Session, pet_type: str, archived: bool = False) -> list[Breed]:
    """One pet type's breeds in order; a fresh database gets the starter list the first time it's read."""
    breeds = list(db.scalars(select(Breed).where(Breed.pet_type == pet_type).order_by(Breed.sort_order, Breed.name)))
    if not breeds:
        breeds = [Breed(id=starter_id(pet_type, name), pet_type=pet_type, name=name, sort_order=i) for i, name in enumerate(STARTER_BREEDS[pet_type])]
        db.add_all(breeds)
        db.commit()
    return breeds if archived else [b for b in breeds if not b.archived]


def breed_options(db: Session, pet_type: str) -> list[BreedOut]:
    return [BreedOut.model_validate(b) for b in list_breeds(db, pet_type)]


def _checked_breed(db: Session, pet_type: str, body: PricedPetIn, pet: Pet | None = None) -> None:
    """The breed must be one of this pet type's, still on the list (a pet keeps an archived breed only while it isn't changed)."""
    breed = next((b for b in list_breeds(db, pet_type, archived=True) if b.id == body.breed_id), None)  # also sets up a fresh shop's list
    unchanged = pet is not None and pet.breed_id == body.breed_id and pet.type == pet_type
    if not breed or (breed.archived and not unchanged):
        raise HTTPException(status_code=400, detail=f"Pick a {pet_type} breed from the list.")


def reprice_pet(db: Session, pet: Pet, before: tuple, by: str | None) -> None:
    """After a change to breed, weight or coat, grooming re-prices the pet's upcoming bookings (the marked exception above)."""
    if before != (pet.breed_id, pet.weight_kg, pet.coat_type):
        from app.grooming.bookings.service import reprice_for_pet  # imported here: grooming reads shared, not the other way round

        reprice_for_pet(db, pet, by)


# ── Pets ──


def _pet_summary(p: Pet, last_groom=None) -> PetSummaryOut:
    return PetSummaryOut(pet=PetOut.model_validate(p), owner=PetOwner.model_validate(p.owner), last_groom=last_groom)


def add_pet(db: Session, c: Customer, body: PetIn) -> Pet:
    _checked_breed(db, body.type, body)
    pet = Pet(customer_id=c.id, **body.model_dump())
    db.add(pet)
    db.commit()
    return pet


def list_pets(db: Session, q: str, pet_type: str | None, vaccination_due: bool, page: int, page_size: int) -> Paged[PetSummaryOut]:
    # join: each pet row together with its owner's row, so the search can look at the owner's name too.
    query = select(Pet).join(Pet.owner)
    if q.strip():
        text = q.strip()
        query = query.where(or_(Pet.name.icontains(text, autoescape=True), Pet.breed_ref.has(Breed.name.icontains(text, autoescape=True)),
                                Customer.name.icontains(text, autoescape=True)))
    if pet_type:
        query = query.where(Pet.type == pet_type)
    if vaccination_due:
        query = query.where(Pet.vaccination.in_(("due_soon", "not_vaccinated")))
    total = db.scalar(select(func.count()).select_from(query.subquery()))
    rows = list(db.scalars(query.order_by(Pet.name, Pet.id).offset((page - 1) * page_size).limit(page_size).options(selectinload(Pet.owner))))
    grooms = overview.last_grooms(db, [p.id for p in rows])
    return Paged(items=[_pet_summary(p, grooms.get(p.id)) for p in rows], total=total, page=page, page_size=page_size)


def pet_counts(db: Session) -> PetCounts:
    by_type = dict(db.execute(select(Pet.type, func.count()).group_by(Pet.type)).all())
    return PetCounts(all=sum(by_type.values()), dog=by_type.get("dog", 0), cat=by_type.get("cat", 0))


def find_pet(db: Session, pet_id: str) -> Pet:
    pet = db.get(Pet, pet_id)
    if not pet:
        raise HTTPException(status_code=404, detail="Pet not found.")
    return pet


def pet_record(db: Session, pet: Pet) -> PetRecordOut:
    visits = overview.pet_visits(db, pet.id)
    return PetRecordOut(pet=PetOut.model_validate(pet), owner=PetOwner.model_validate(pet.owner), visits=visits,
                        last_groom=visits[0].date if visits else None)


def update_pet(db: Session, pet: Pet, body: PetIn, by: str) -> Pet:
    """Bookings read the pet's record, so they show the new details too; a new breed, weight or coat re-prices the upcoming ones."""
    _checked_breed(db, body.type, body, pet)
    before = (pet.breed_id, pet.weight_kg, pet.coat_type)
    for field, value in body.model_dump().items():
        setattr(pet, field, value)
    db.flush()
    db.expire(pet, ["breed_ref"])  # so pet.breed names the new breed
    reprice_pet(db, pet, before, by)
    db.commit()
    return pet


# ── The customer app: a customer's own pets ──

TEMPERAMENTS = {"calm": "Calm", "friendly": "Friendly", "playful": "Playful", "anxious": "Anxious", "shy-with-strangers": "Shy with strangers"}


def app_pet(p: Pet) -> AppPetOut:
    """The shared pet record in the app's words: "Calm, shy with strangers" → two choices."""
    temperament = (p.temperament or "").lower()
    return AppPetOut(
        id=p.id, name=p.name, type=p.type, breed_id=p.breed_id, breed=p.breed, birth_date=p.birth_date, gender=p.gender,
        weight_kg=p.weight_kg, coat_type=p.coat_type,
        temperament=[key for key, label in TEMPERAMENTS.items() if label.lower() in temperament],
        vaccination=p.vaccination.replace("_", "-"), notes=p.notes,
    )


def _app_fields(body: AppPetIn) -> dict:
    """The app's choices as the shared record keeps them (health notes are staff's, so they stay as they are)."""
    return {
        "name": body.name, "type": body.type, "breed_id": body.breed_id, "birth_date": body.birth_date, "gender": body.gender,
        "weight_kg": body.weight_kg, "coat_type": body.coat_type,
        "temperament": ", ".join(TEMPERAMENTS[t] for t in body.temperament) or None,
        "vaccination": body.vaccination.replace("-", "_"), "notes": body.notes,
    }


def my_pets(db: Session, c: Customer) -> list[AppPetOut]:
    return [app_pet(p) for p in c.pets]


def my_pet(db: Session, c: Customer, pet_id: str) -> Pet:
    """One of this customer's pets. Anyone else's pet is "not found", the same as a pet that doesn't exist."""
    pet = db.get(Pet, pet_id)
    if not pet or pet.customer_id != c.id:
        raise HTTPException(status_code=404, detail="Pet not found.")
    return pet


def add_my_pet(db: Session, c: Customer, body: AppPetIn) -> AppPetOut:
    if len(c.pets) >= 10:
        raise HTTPException(status_code=409, detail="You can add up to 10 pets. Call us if you have more.")
    _checked_breed(db, body.type, body)
    pet = Pet(customer_id=c.id, **_app_fields(body))
    db.add(pet)
    db.commit()
    return app_pet(pet)


def update_my_pet(db: Session, pet: Pet, body: AppPetIn) -> AppPetOut:
    _checked_breed(db, body.type, body, pet)
    before = (pet.breed_id, pet.weight_kg, pet.coat_type)
    for field, value in _app_fields(body).items():
        setattr(pet, field, value)
    db.flush()
    db.expire(pet, ["breed_ref"])  # so pet.breed names the new breed
    reprice_pet(db, pet, before, f"{pet.owner.name} (in the app)")
    db.commit()
    return app_pet(pet)
