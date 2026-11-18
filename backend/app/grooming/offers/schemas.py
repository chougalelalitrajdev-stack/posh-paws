"""Offer shapes, checked with the admin's messages."""

import datetime as dt
import re
from typing import Literal

from pydantic import ConfigDict, Field, field_validator, model_validator

from app.core.schemas import CamelModel, one_of

DiscountType = Literal["percent", "flat"]
OfferScope = Literal["all_services", "some_services", "plans"]
OfferStatus = Literal["draft", "scheduled", "live", "paused", "expired", "used_up"]


class OfferIn(CamelModel):
    """Body of POST /admin/offers and PUT /admin/offers/{id}."""

    model_config = ConfigDict(str_strip_whitespace=True)

    title: str = Field(max_length=80)
    discount_type: DiscountType
    value: int
    code: str | None = None
    applies_to: OfferScope
    service_ids: list[str] = []
    starts_on: dt.date
    ends_on: dt.date | None = None
    total_uses: int | None = None
    per_customer: int | None = None
    new_customers_only: bool = False
    draft: bool = False

    @field_validator("title")
    @classmethod
    def title_given(cls, v: str) -> str:
        if not v:
            raise ValueError("Enter a title.")
        return v

    @field_validator("discount_type", mode="before")
    @classmethod
    def discount_type_known(cls, v):
        return one_of(v, DiscountType, "Pick % or ₹ flat.")

    @field_validator("value")
    @classmethod
    def value_given(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("Enter a discount value.")
        return v

    @field_validator("code")
    @classmethod
    def code_looks_right(cls, v: str | None) -> str | None:
        """Codes are stored upper-case, so customers can type them either way."""
        if not v:
            return None
        if not re.fullmatch(r"[A-Z0-9]{3,20}", v.upper()):
            raise ValueError("Codes use 3–20 letters and numbers, no spaces.")
        return v.upper()

    @field_validator("applies_to", mode="before")
    @classmethod
    def applies_to_known(cls, v):
        return one_of(v, OfferScope, "Pick what the offer applies to.")

    @field_validator("starts_on", mode="before")
    @classmethod
    def start_given(cls, v):
        if not v:
            raise ValueError("Pick a start date.")
        return v

    @field_validator("ends_on", mode="before")
    @classmethod
    def no_empty_end(cls, v):
        return v or None

    @field_validator("total_uses", "per_customer")
    @classmethod
    def at_least_one(cls, v: int | None) -> int | None:
        """None = no limit; anything else is at least 1."""
        return None if v is None else max(1, v)

    @model_validator(mode="after")
    def fits_together(self) -> "OfferIn":
        if self.discount_type == "percent" and self.value > 100:
            raise ValueError("A percentage can't be more than 100.")
        if self.ends_on and self.ends_on < self.starts_on:
            raise ValueError("The end date is before the start date.")
        if self.applies_to == "some_services" and not self.service_ids:
            raise ValueError("Pick at least one service.")
        if self.applies_to != "some_services":
            self.service_ids = []
        return self


class OfferOut(CamelModel):
    id: str
    title: str
    discount_type: DiscountType
    value: int
    code: str | None
    applies_to: OfferScope
    service_ids: list[str]
    starts_on: dt.date
    ends_on: dt.date | None
    total_uses: int | None
    per_customer: int | None
    new_customers_only: bool
    draft: bool
    paused: bool
    used: int
    status: OfferStatus = "draft"  # filled in by the service from the dates, limits and flags
