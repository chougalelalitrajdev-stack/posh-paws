"""Customer login shapes (customer app: core/models/user.model.ts)."""

import re
from typing import Literal

from pydantic import ConfigDict, Field, field_validator

from app.core.schemas import CamelModel
from app.shared.customers.schemas import phone_digits


class PhoneIn(CamelModel):
    """POST /auth/otp/send."""

    phone: str

    @field_validator("phone")
    @classmethod
    def ten_digits(cls, v: str) -> str:
        if len(phone_digits(v)) != 10:
            raise ValueError("Enter a 10-digit mobile number.")
        return phone_digits(v)


class CodeIn(PhoneIn):
    """POST /auth/otp/verify."""

    code: str

    @field_validator("code")
    @classmethod
    def six_digits(cls, v: str) -> str:
        if not re.fullmatch(r"\d{6}", v.strip()):
            raise ValueError("Enter the 6-digit code.")
        return v.strip()


class SignUpIn(PhoneIn):
    """POST /auth/register: a new customer, right after confirming their number."""

    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(max_length=80)
    email: str | None = Field(default=None, max_length=120)

    @field_validator("name")
    @classmethod
    def name_given(cls, v: str) -> str:
        if not v:
            raise ValueError("Enter your name.")
        return v

    @field_validator("email")
    @classmethod
    def email_looks_right(cls, v: str | None) -> str | None:
        if v and not re.match(r"^\S+@\S+\.\S+$", v):
            raise ValueError("That email doesn't look right.")
        return v or None


class CustomerUser(CamelModel):
    id: str
    name: str
    phone: str
    email: str | None = None


class SessionOut(CamelModel):
    """A logged-in customer and their token (the app sends it with every call)."""

    user: CustomerUser
    token: str


class VerifyOut(CamelModel):
    """authenticated: logged in · new-user: the number is confirmed but has no account yet (sign up next)."""

    status: Literal["authenticated", "new-user"]
    user: CustomerUser | None = None
    token: str | None = None
