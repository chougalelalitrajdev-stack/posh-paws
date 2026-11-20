"""Service and station shapes. Each one is checked here before it's saved, with the admin's messages."""

from typing import Literal

from pydantic import ConfigDict, Field, field_validator

from app.core.schemas import CamelModel, image_address, one_of

PetType = Literal["dog", "cat"]
Category = Literal["Bath", "Haircut", "Package", "Add-on", "Treatment"]
StationScope = Literal["all", "dogs", "cats", "some"]
MAX_DESCRIPTION = 140


# ── Services ──


class ServiceIn(CamelModel):
    """Body of POST /admin/services and PUT /admin/services/{id}. Prices are integer paise."""

    model_config = ConfigDict(str_strip_whitespace=True)  # added to CamelModel's settings

    name: str = Field(max_length=80)
    pet_type: PetType
    category: Category
    description: str = ""
    duration_minutes: int
    price_paise: int
    image_url: str | None = None
    visible: bool = True

    @field_validator("name")
    @classmethod
    def name_given(cls, v: str) -> str:
        if not v:
            raise ValueError("Enter a name.")
        return v

    @field_validator("pet_type", mode="before")
    @classmethod
    def pet_type_known(cls, v):
        return one_of(v, PetType, "Is it for dogs or cats?")

    @field_validator("category", mode="before")
    @classmethod
    def category_known(cls, v):
        return one_of(v, Category, "Pick a category.")

    @field_validator("description")
    @classmethod
    def description_short(cls, v: str) -> str:
        if len(v) > MAX_DESCRIPTION:
            raise ValueError(f"Keep the description under {MAX_DESCRIPTION} characters.")
        return v

    @field_validator("duration_minutes")
    @classmethod
    def duration_given(cls, v: int) -> int:
        if v < 5:
            raise ValueError("Pick a duration.")
        return v

    @field_validator("price_paise")
    @classmethod
    def price_given(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("Enter a price in whole rupees.")
        return v

    @field_validator("image_url")
    @classmethod
    def image_looks_right(cls, v: str | None) -> str | None:
        return image_address(v)


class ServiceOut(CamelModel):
    id: str
    name: str
    pet_type: PetType
    category: Category
    description: str
    duration_minutes: int
    price_paise: int
    image_url: str | None
    visible: bool
    archived: bool
    sort_order: int
    # Upcoming bookings for the service: counted once bookings live in the backend (Module 5).
    upcoming_bookings: int = 0


class ServiceOrderIn(CamelModel):
    """PUT /admin/services/order: one pet type's services, in their new order."""

    pet_type: PetType
    ids: list[str]


# ── Stations ──


class StationIn(CamelModel):
    """Body of POST /admin/stations and PUT /admin/stations/{id}."""

    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(max_length=40)
    active: bool = True
    can_do: StationScope
    service_ids: list[str] = []
    held_back: bool = False  # customers only get it at the times staff open for it

    @field_validator("name")
    @classmethod
    def name_given(cls, v: str) -> str:
        if not v:
            raise ValueError("Name the station, e.g. Table 3 or Cat corner.")
        return v

    @field_validator("can_do", mode="before")
    @classmethod
    def can_do_known(cls, v):
        return one_of(v, StationScope, "Pick what the station can do.")


class StationOut(CamelModel):
    id: str
    name: str
    active: bool
    can_do: StationScope
    service_ids: list[str]
    held_back: bool


# ── The customer app (public: only what customers may see) ──

ICONS = {"Bath": "🛁", "Haircut": "✂️", "Package": "👑", "Add-on": "💅", "Treatment": "🌿"}


class PublicServiceOut(CamelModel):
    """A service on the customer app: visible, not archived. No internal fields (order, counts, archived)."""

    id: str
    pet_type: PetType
    icon: str = ""  # from the category
    name: str
    description: str
    price_paise: int
    duration_minutes: int
    image_url: str | None
