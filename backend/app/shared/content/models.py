"""What the customer app shows besides the catalog: banners, gallery photos and their categories, the pages' words, and FAQs.
Lists are kept in display order by `sort_order`."""

import datetime as dt
from uuid import uuid4

from sqlalchemy import Boolean, CheckConstraint, Date, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


def _new_id() -> str:
    return str(uuid4())


class Banner(Base):
    """A promo banner. The first live banner in each placement is the one the app shows."""

    __tablename__ = "banners"
    __table_args__ = (
        CheckConstraint("placement in ('home_hero', 'home_promo', 'services', 'membership')", name="banner_placement_known"),
        CheckConstraint("link in ('home', 'services', 'book', 'membership', 'gallery', 'about')", name="banner_link_known"),
    )

    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=_new_id)
    placement: Mapped[str] = mapped_column(String(12))
    title: Mapped[str] = mapped_column(String(48))
    subtitle: Mapped[str] = mapped_column(String(160), default="")
    button_text: Mapped[str] = mapped_column(String(30))
    link: Mapped[str] = mapped_column(String(12))  # the customer app page the button opens
    image_url: Mapped[str | None] = mapped_column(Text)  # portrait, for phones
    desktop_image_url: Mapped[str | None] = mapped_column(Text)  # wide, for tablets and desktops
    starts_on: Mapped[dt.date] = mapped_column(Date)
    ends_on: Mapped[dt.date | None] = mapped_column(Date)
    paused: Mapped[bool] = mapped_column(Boolean, default=False)
    sort_order: Mapped[int]


class GalleryCategory(Base):
    __tablename__ = "gallery_categories"

    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=_new_id)
    name: Mapped[str] = mapped_column(String(40))
    sort_order: Mapped[int]


class GalleryPhoto(Base):
    """A photo on the app's Gallery page. New uploads start hidden, to be captioned before customers see them."""

    __tablename__ = "gallery_photos"

    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=_new_id)
    image_url: Mapped[str] = mapped_column(Text)
    caption: Mapped[str] = mapped_column(String(120), default="")
    category_id: Mapped[str] = mapped_column(ForeignKey("gallery_categories.id"))
    pet: Mapped[str] = mapped_column(String(60), default="")  # pet or breed shown under the caption
    visible: Mapped[bool] = mapped_column(Boolean, default=False)
    sort_order: Mapped[int]


class SitePage(Base):
    """A customer app page's words. Its sections are read and saved whole, so they're JSONB, like settings.
    Staff save a draft, then publish it; customers only ever see the published sections."""

    __tablename__ = "site_pages"

    key: Mapped[str] = mapped_column(String(12), primary_key=True)  # home | about | terms | privacy
    title: Mapped[str] = mapped_column(String(40))
    sections: Mapped[list[dict]] = mapped_column(JSONB)
    # none_as_null: no draft is stored as SQL NULL, not JSON null (which "draft IS NOT NULL" would count as a draft).
    draft: Mapped[list[dict] | None] = mapped_column(JSONB(none_as_null=True))
    published_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True))
    published_by: Mapped[str] = mapped_column(String(80))
    draft_saved_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True))
    draft_saved_by: Mapped[str | None] = mapped_column(String(80))


class FaqGroup(Base):
    __tablename__ = "faq_groups"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    name: Mapped[str] = mapped_column(String(40))
    shown_on: Mapped[str] = mapped_column(String(80))  # the app pages that show it, e.g. "Services, Booking"
    sort_order: Mapped[int]


class Faq(Base):
    __tablename__ = "faqs"

    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=_new_id)
    group_id: Mapped[str] = mapped_column(ForeignKey("faq_groups.id"))
    question: Mapped[str] = mapped_column(String(200))
    answer: Mapped[str] = mapped_column(Text)
    sort_order: Mapped[int]
