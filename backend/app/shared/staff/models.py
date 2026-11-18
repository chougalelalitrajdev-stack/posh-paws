"""The staff_users table: one row per person who can sign in to the admin."""

from datetime import datetime
from uuid import uuid4

from sqlalchemy import CheckConstraint, DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class StaffUser(Base):
    __tablename__ = "staff_users"
    # The database itself refuses any other role or status, even if code had a bug.
    __table_args__ = (
        CheckConstraint("role in ('super_admin', 'admin', 'staff')", name="staff_role_known"),
        CheckConstraint("status in ('active', 'invited')", name="staff_status_known"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    name: Mapped[str] = mapped_column(String(80))
    # Stored lower-case; unique, so two accounts can't share an email.
    email: Mapped[str] = mapped_column(String(254), unique=True, index=True)
    # A salted scrypt hash (app.core.security), never the password. Empty for invited people until they set one.
    password_hash: Mapped[str | None] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(20))
    status: Mapped[str] = mapped_column(String(20), default="active")
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
