"""Customer and pet shapes, checked with the admin's messages."""

import datetime as dt
import re
from typing import Literal

from pydantic import ConfigDict, Field, field_validator

from app.core.schemas import CamelModel

PetType = Literal["dog", "cat"]
Vaccination = Literal["up_to_date", "due_soon", "not_vaccinated", "unknown"]
Segment = Literal["all", "members", "new", "lapsed", "no_plan"]


def phone_digits(value: str) -> str:
    """The last 10 digits, so "+91 98220 41763" and "9822041763" are the same number."""
    return re.sub(r"\D", "", value or "")[-10:]


# ── Pets ──


class PetIn(CamelModel):
    """Body of POST /admin/customers/{id}/pets and PUT /admin/pets/{id}. Only the name and dog/cat are required."""

    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(max_length=40)
    type: PetType
    breed: str | None = Field(default=None, max_length=60)
    birth_date: dt.date | None = None
    gender: Literal["male", "female"] | None = None
    weight_kg: float | None = None
    coat: str | None = Field(default=None, max_length=40)
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

    @field_validator("birth_date", "gender", "weight_kg", mode="before")
    @classmethod
    def empty_is_missing(cls, v):
        """The form sends "" (or 0 kg) for a detail nobody filled in."""
        return v or None

    @field_validator("vaccination", mode="before")
    @classmethod
    def unknown_when_missing(cls, v):
        return v or "unknown"

    @field_validator("breed", "coat", "temperament", "notes", "health_notes")
    @classmethod
    def blank_is_missing(cls, v: str | None) -> str | None:
        return v or None


class PetOut(CamelModel):
    id: str
    name: str
    type: PetType
    breed: str | None
    birth_date: dt.date | None
    gender: Literal["male", "female"] | None
    weight_kg: float | None
    coat: str | None
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
    last_groom: dt.date | None = None  # from completed bookings (Module 5)


class Visit(CamelModel):
    booking_id: str
    service_name: str
    date: dt.date


class PetRecordOut(PetSummaryOut):
    """GET /admin/pets/{id}: the pet, its owner and past visits."""

    visits: list[Visit] = []  # from completed bookings (Module 5)


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


class CustomerOut(CamelModel):
    """A customer's profile. The numbers at the end are worked out from bookings, payments and memberships, so they're
    empty until those modules are in the backend (bookings 5, money 6, memberships 7)."""

    id: str
    name: str
    phone: str
    email: str | None
    area: str | None
    customer_since: dt.datetime
    pets: list[PetOut]
    staff_note: StaffNote | None = None
    plan: dict | None = None  # the active membership (Module 7)
    past_bookings: int = 0
    bookings_count: int = 0
    spent_paise: int = 0
    last_visit: LastVisit | None = None


class NextUp(CamelModel):
    kind: Literal["booking", "draft"]
    date: dt.date | None = None
    time: str | None = None


class CustomerSummaryOut(CamelModel):
    """One row of GET /admin/customers. Like CustomerOut, the booking and plan numbers fill in with Modules 5–7."""

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
