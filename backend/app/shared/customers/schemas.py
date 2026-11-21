"""Customer and pet shapes, checked with the admin's messages."""

import datetime as dt
import re
from typing import Literal

from pydantic import ConfigDict, Field, field_validator

from app.core.schemas import CamelModel

PetType = Literal["dog", "cat"]
Vaccination = Literal["up_to_date", "due_soon", "not_vaccinated", "unknown"]
CoatType = Literal["single", "double", "triple"]
COAT_LABELS = {"single": "Single coat", "double": "Double coat", "triple": "Triple coat"}
MAX_WEIGHT_KG = 120
Segment = Literal["all", "members", "new", "lapsed", "no_plan"]


def phone_digits(value: str) -> str:
    """The last 10 digits, so "+91 98220 41763" and "9822041763" are the same number."""
    return re.sub(r"\D", "", value or "")[-10:]


# ── Pets ──


class PricedPetIn(CamelModel):
    """Breed, weight and coat: required on every pet, because most services are priced by them (both apps send them)."""

    breed_id: str
    weight_kg: float
    coat_type: CoatType

    @field_validator("breed_id", mode="before")
    @classmethod
    def breed_given(cls, v):
        if not v:
            raise ValueError("Pick the breed.")
        return v

    @field_validator("weight_kg", mode="before")
    @classmethod
    def weight_given(cls, v):
        try:
            kg = float(v)
        except (TypeError, ValueError):
            raise ValueError("Enter the weight in kg.") from None
        if not 0 < kg <= MAX_WEIGHT_KG:
            raise ValueError(f"Enter a weight between 0.1 and {MAX_WEIGHT_KG} kg.")
        return round(kg, 1)

    @field_validator("coat_type", mode="before")
    @classmethod
    def coat_given(cls, v):
        if v not in COAT_LABELS:
            raise ValueError("Pick the coat: single, double or triple.")
        return v


class BreedOut(CamelModel):
    id: str
    pet_type: PetType
    name: str


class PetIn(PricedPetIn):
    """Body of POST /admin/customers/{id}/pets and PUT /admin/pets/{id}. Only the name and dog/cat are required."""

    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(max_length=40)
    type: PetType
    birth_date: dt.date | None = None
    gender: Literal["male", "female"] | None = None
    temperament: str | None = Field(default=None, max_length=80)
    vaccination: Vaccination = "unknown"
    notes: str | None = None
    health_notes: str | None = None

    @field_validator("name")
    @classmethod
    def name_given(cls, v: str) -> str:
        if not v:
            raise ValueError("Enter the pet's name.")
        return v

    @field_validator("type", mode="before")
    @classmethod
    def type_known(cls, v):
        if v not in ("dog", "cat"):
            raise ValueError("Is it a dog or a cat?")
        return v

    @field_validator("birth_date", "gender", mode="before")
    @classmethod
    def empty_is_missing(cls, v):
        """The form sends "" for a detail nobody filled in."""
        return v or None

    @field_validator("vaccination", mode="before")
    @classmethod
    def unknown_when_missing(cls, v):
        return v or "unknown"

    @field_validator("temperament", "notes", "health_notes")
    @classmethod
    def blank_is_missing(cls, v: str | None) -> str | None:
        return v or None


class PetOut(CamelModel):
    id: str
    name: str
    type: PetType
    breed_id: str | None  # None, and no weight or coat, only on pets added before they were required
    breed: str | None
    birth_date: dt.date | None
    gender: Literal["male", "female"] | None
    weight_kg: float | None
    coat_type: CoatType | None
    temperament: str | None
    vaccination: Vaccination
    notes: str | None
    health_notes: str | None


class PetOwner(CamelModel):
    id: str
    name: str
    phone: str


class PetSummaryOut(CamelModel):
    """One row of GET /admin/pets."""

    pet: PetOut
    owner: PetOwner
    last_groom: dt.date | None = None


class Visit(CamelModel):
    booking_id: str
    service_name: str
    date: dt.date


class PetRecordOut(PetSummaryOut):
    """GET /admin/pets/{id}: the pet, its owner and past visits."""

    visits: list[Visit] = []


class PetCounts(CamelModel):
    all: int
    dog: int
    cat: int


# ── Customers ──


class CustomerIn(CamelModel):
    """Body of POST /admin/customers and PUT /admin/customers/{id}."""

    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(max_length=80)
    phone: str
    email: str | None = Field(default=None, max_length=120)
    area: str | None = Field(default=None, max_length=80)

    @field_validator("name")
    @classmethod
    def name_given(cls, v: str) -> str:
        if not v:
            raise ValueError("Enter the customer's name.")
        return v

    @field_validator("phone")
    @classmethod
    def ten_digits(cls, v: str) -> str:
        digits = phone_digits(v)
        if len(digits) != 10:
            raise ValueError("Enter a 10-digit mobile number.")
        return digits

    @field_validator("email")
    @classmethod
    def email_looks_right(cls, v: str | None) -> str | None:
        if v and not re.match(r"^\S+@\S+\.\S+$", v):
            raise ValueError("That email doesn't look right.")
        return v or None

    @field_validator("area")
    @classmethod
    def blank_is_missing(cls, v: str | None) -> str | None:
        return v or None


class NoteIn(CamelModel):
    """PUT /admin/customers/{id}/note: empty text removes the note."""

    text: str = ""


class StaffNote(CamelModel):
    text: str
    by: str
    at: dt.datetime


class LastVisit(CamelModel):
    date: dt.date
    service_name: str
    pet_name: str


class CustomerPlan(CamelModel):
    """A customer's active membership, as bills and the profile need it (filled in by grooming's memberships)."""

    subscription_id: str
    name: str
    discount_percent: int
    price_paise: int
    sessions_left: int | None  # None = unlimited
    sessions_total: int | None
    eligible_service_ids: list[str]
    renews_on: dt.date | None
    next_plan_name: str | None


class CustomerOut(CamelModel):
    """A customer's profile. The numbers at the end are worked out from bookings, payments and memberships (overview.py)."""

    id: str
    name: str
    phone: str
    email: str | None
    area: str | None
    customer_since: dt.datetime
    pets: list[PetOut]
    staff_note: StaffNote | None = None
    plan: CustomerPlan | None = None
    past_bookings: int = 0
    bookings_count: int = 0
    spent_paise: int = 0
    last_visit: LastVisit | None = None


class NextUp(CamelModel):
    kind: Literal["booking", "draft"]
    date: dt.date | None = None
    time: str | None = None


class CustomerSummaryOut(CamelModel):
    """One row of GET /admin/customers."""

    id: str
    name: str
    phone: str
    pet_names: list[str]
    plan_name: str | None = None
    bookings_count: int = 0
    spent_paise: int = 0
    last_visit: dt.date | None = None
    lapsed: bool = False  # not seen in 90 days
    next: NextUp | None = None


# ── Top-bar search ──


class SearchCustomer(CamelModel):
    id: str
    name: str
    phone: str
    pet_names: list[str]


class SearchPet(CamelModel):
    id: str
    name: str
    type: PetType
    breed: str | None
    owner_name: str


class SearchBooking(CamelModel):
    id: str
    customer_name: str
    pet_name: str | None
    service_name: str | None
    date: dt.date | None
    time: str | None
    stage: str


class SearchResults(CamelModel):
    """GET /admin/search?q=: a few matches of each kind."""

    customers: list[SearchCustomer]
    pets: list[SearchPet]
    bookings: list[SearchBooking]


# ── The customer app: a customer's own pets (customer app: core/models/pet.model.ts) ──
# The app picks temperament from a list; the shared pet record keeps it as text the admin also edits.

AppTemperament = Literal["calm", "friendly", "playful", "anxious", "shy-with-strangers"]
AppVaccination = Literal["up-to-date", "due-soon", "not-vaccinated", "unknown"]


class AppPetIn(PricedPetIn):
    """Body of POST /pets and PUT /pets/{id} in the customer app."""

    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(max_length=40)
    type: PetType
    birth_date: dt.date | None = None
    gender: Literal["male", "female"] | None = None
    temperament: list[AppTemperament] = []
    vaccination: AppVaccination = "unknown"
    notes: str | None = Field(default=None, max_length=500)

    @field_validator("name")
    @classmethod
    def name_given(cls, v: str) -> str:
        if not v:
            raise ValueError("Enter your pet's name.")
        return v

    @field_validator("type", mode="before")
    @classmethod
    def type_known(cls, v):
        if v not in ("dog", "cat"):
            raise ValueError("Is it a dog or a cat?")
        return v

    @field_validator("birth_date", "gender", mode="before")
    @classmethod
    def empty_is_missing(cls, v):
        return v or None

    @field_validator("vaccination", mode="before")
    @classmethod
    def unknown_when_missing(cls, v):
        return v or "unknown"

    @field_validator("notes")
    @classmethod
    def blank_is_missing(cls, v: str | None) -> str | None:
        return v or None


class AppPetOut(CamelModel):
    id: str
    name: str
    type: PetType
    breed_id: str | None  # None, and no weight or coat, on pets added before they were required: the app asks for them
    breed: str | None
    birth_date: dt.date | None
    gender: Literal["male", "female"] | None
    weight_kg: float | None
    coat_type: CoatType | None
    temperament: list[AppTemperament]
    vaccination: AppVaccination
    notes: str | None
