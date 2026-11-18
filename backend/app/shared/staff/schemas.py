"""Shapes of the sign-in and team requests and responses (camelCase JSON via CamelModel)."""

from datetime import datetime
from typing import Literal

from pydantic import Field, field_validator

from app.core.schemas import CamelModel

StaffRole = Literal["super_admin", "admin", "staff"]


class StaffOut(CamelModel):
    """Who is signed in (the admin keeps it with the token)."""

    id: str
    name: str
    email: str
    role: StaffRole


class TeamMemberOut(StaffOut):
    """One row of Settings › Team & roles."""

    status: Literal["active", "invited"]
    last_seen_at: datetime | None


class LoginIn(CamelModel):
    email: str
    password: str


class LoginOut(CamelModel):
    user: StaffOut
    token: str


class ForgotPasswordIn(CamelModel):
    email: str


class InviteIn(CamelModel):
    name: str = Field(min_length=1, max_length=80)
    email: str
    role: StaffRole

    @field_validator("name")
    @classmethod
    def name_given(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Enter their name.")
        return v.strip()

    @field_validator("email")
    @classmethod
    def email_looks_right(cls, v: str) -> str:
        v = v.strip().lower()
        if "@" not in v or "." not in v.split("@")[-1]:
            raise ValueError("Enter their email.")
        return v


class RoleIn(CamelModel):
    role: StaffRole
