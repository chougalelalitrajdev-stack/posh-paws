"""The customers table and the pets table. One customer has many pets: each pet row points at its owner (customer_id)."""

import datetime as dt
from uuid import uuid4

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Customer(Base):
    """One account per person, shared by grooming now and the store and vet care later."""

    __tablename__ = "customers"

    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=lambda: str(uuid4()))
    name: Mapped[str] = mapped_column(String(80))
    # 10 digits, no spaces. Unique: it's how staff (and later the app's login) find a customer.
    phone: Mapped[str] = mapped_column(String(10), unique=True)
    email: Mapped[str | None] = mapped_column(String(120))
    area: Mapped[str | None] = mapped_column(String(80))  # neighbourhood, e.g. "Viman Nagar, Pune"
    customer_since: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    # The staff note on the profile ("Prefers evening slots"), who wrote it and when.
    note_text: Mapped[str | None] = mapped_column(Text)
    note_by: Mapped[str | None] = mapped_column(String(80))
    note_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True))

    # Not a column: SQLAlchemy fills customer.pets from the pets table (rows whose customer_id is this customer's id).
    pets: Mapped[list["Pet"]] = relationship(back_populates="owner", order_by="Pet.created_at")


class Pet(Base):
    """A pet's profile, used by every visit: grooming now, vet care later."""

    __tablename__ = "pets"
    __table_args__ = (
        CheckConstraint("type in ('dog', 'cat')", name="pet_type_known"),
        CheckConstraint("gender in ('male', 'female')", name="pet_gender_known"),
        CheckConstraint("vaccination in ('up_to_date', 'due_soon', 'not_vaccinated', 'unknown')", name="pet_vaccination_known"),
    )

    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=lambda: str(uuid4()))
    # A foreign key: the database only accepts the id of a customer that exists. Indexed, so "this customer's pets" is quick.
    customer_id: Mapped[str] = mapped_column(ForeignKey("customers.id"), index=True)
    name: Mapped[str] = mapped_column(String(40))
    type: Mapped[str] = mapped_column(String(3))
    breed: Mapped[str | None] = mapped_column(String(60))
    birth_date: Mapped[dt.date | None] = mapped_column(Date)
    gender: Mapped[str | None] = mapped_column(String(6))
    weight_kg: Mapped[float | None]
    coat: Mapped[str | None] = mapped_column(String(40))  # size and coat, e.g. "Small · long"
    temperament: Mapped[str | None] = mapped_column(String(80))
    vaccination: Mapped[str] = mapped_column(String(16), default="unknown")
    notes: Mapped[str | None] = mapped_column(Text)  # grooming notes staff see before every visit
    health_notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    owner: Mapped[Customer] = relationship(back_populates="pets")
