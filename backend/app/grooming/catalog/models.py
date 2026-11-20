"""The services table (the grooming menu) and the stations table (the tables and rooms the grooming happens at)."""

import datetime as dt
from uuid import uuid4

from sqlalchemy import Boolean, CheckConstraint, DateTime, String, Text, false, func
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Service(Base):
    """A grooming service. Never deleted: archived services leave the app and new bookings but keep their history."""

    __tablename__ = "services"
    __table_args__ = (CheckConstraint("pet_type in ('dog', 'cat')", name="service_pet_type_known"),)

    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=lambda: str(uuid4()))
    name: Mapped[str] = mapped_column(String(80))
    pet_type: Mapped[str] = mapped_column(String(3))
    category: Mapped[str] = mapped_column(String(20))  # Bath | Haircut | Package | Add-on | Treatment
    description: Mapped[str] = mapped_column(Text, default="")
    duration_minutes: Mapped[int]
    price_paise: Mapped[int]
    # A link to the photo. Until real photo storage (Module 8) the admin's demo upload sends the photo itself (a data URL).
    image_url: Mapped[str | None] = mapped_column(Text)
    visible: Mapped[bool] = mapped_column(Boolean, default=True)  # shown in the customer app
    archived: Mapped[bool] = mapped_column(Boolean, default=False)
    sort_order: Mapped[int]  # position within its pet type, 0 = first
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Station(Base):
    """A grooming table or room. Each booking holds one station, so the stations in use decide how many pets are groomed at once."""

    __tablename__ = "stations"
    __table_args__ = (CheckConstraint("can_do in ('all', 'dogs', 'cats', 'some')", name="station_can_do_known"),)

    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=lambda: str(uuid4()))
    name: Mapped[str] = mapped_column(String(40))
    # Off: no new bookings on it (repairs, groomer on leave); bookings already on it stay.
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    can_do: Mapped[str] = mapped_column(String(4))
    # can_do = 'some': the services it can do. ARRAY is a list inside one column; services are never deleted, so the ids stay valid.
    service_ids: Mapped[list[str]] = mapped_column(ARRAY(String(40)), default=list)
    # Held back: staff can always book it; customers only get it at the start times staff open for it (Availability › Day).
    held_back: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false())
    sort_order: Mapped[int]  # calendar column order
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
