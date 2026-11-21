"""The extras a pet adds to a service's price, one row per pet type (Catalog › Pet pricing)."""

import datetime as dt

from sqlalchemy import DateTime, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class PetPricing(Base):
    """One pet type's weight bands, coat extras and notes, and breed extras. Read and saved whole, like a settings section;
    a pet type with no row uses the defaults in service.py (no extras)."""

    __tablename__ = "pet_pricing"

    pet_type: Mapped[str] = mapped_column(String(3), primary_key=True)  # dog | cat
    value: Mapped[dict] = mapped_column(JSONB)  # schemas.StoredPricing
    updated_by: Mapped[str | None] = mapped_column(String(80))
    updated_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
