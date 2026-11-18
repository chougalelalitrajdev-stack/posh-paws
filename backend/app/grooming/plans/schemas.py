"""Membership plan shapes, checked with the admin's messages."""

from typing import Literal

from pydantic import ConfigDict, Field, field_validator

from app.core.schemas import CamelModel, one_of

Billing = Literal["month", "quarter", "year"]


class Benefit(CamelModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    text: str = ""
    included: bool = False


class PlanIn(CamelModel):
    """Body of POST /admin/plans and PUT /admin/plans/{id}."""

    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(max_length=40)
    tagline: str = Field(default="", max_length=120)
    price_paise: int
    billing: Billing
    sessions_per_period: int | None = None
    discount_percent: int = 0
    eligible_service_ids: list[str] = []
    benefits: list[Benefit] = []
    featured: bool = False
    subscribable: bool = True

    @field_validator("name")
    @classmethod
    def name_given(cls, v: str) -> str:
        if not v:
            raise ValueError("Enter a plan name.")
        return v

    @field_validator("price_paise")
    @classmethod
    def price_given(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("Enter a price in whole rupees.")
        return v

    @field_validator("billing", mode="before")
    @classmethod
    def billing_known(cls, v):
        return one_of(v, Billing, "Pick how often it's billed.")

    @field_validator("sessions_per_period")
    @classmethod
    def sessions_sensible(cls, v: int | None) -> int | None:
        if v is not None and v < 1:
            raise ValueError("Sessions must be 1 or more, or unlimited.")
        return v

    @field_validator("discount_percent")
    @classmethod
    def discount_sensible(cls, v: int) -> int:
        if not 0 <= v <= 90:
            raise ValueError("Discount must be between 0% and 90%.")
        return v

    @field_validator("benefits")
    @classmethod
    def no_blank_benefits(cls, v: list[Benefit]) -> list[Benefit]:
        return [b for b in v if b.text]


class PlanOut(CamelModel):
    id: str
    name: str
    tagline: str
    price_paise: int
    billing: Billing
    sessions_per_period: int | None
    discount_percent: int
    eligible_service_ids: list[str]
    benefits: list[Benefit]
    featured: bool
    subscribable: bool
    # Members on the plan: counted once subscriptions live in the backend (Module 7).
    active_subscribers: int = 0
