"""Content shapes (admin: core/models/banner.model.ts, gallery.model.ts, page.model.ts), checked with the admin's messages."""

import datetime as dt
from typing import Literal

from pydantic import ConfigDict, field_validator, model_validator

from app.core.schemas import CamelModel, image_address, one_of

Placement = Literal["home_hero", "home_promo", "services", "membership"]
AppLink = Literal["home", "services", "book", "membership", "gallery", "about"]
TITLE_MAX = 48

# ── Banners ──


class BannerIn(CamelModel):
    """Body of POST /admin/banners and PUT /admin/banners/{id}."""

    model_config = ConfigDict(str_strip_whitespace=True)

    placement: Placement
    title: str
    subtitle: str = ""
    button_text: str
    link: AppLink
    image_url: str | None = None
    desktop_image_url: str | None = None
    starts_on: dt.date
    ends_on: dt.date | None = None

    @field_validator("placement", mode="before")
    @classmethod
    def placement_known(cls, v):
        return one_of(v, Placement, "Pick where the banner shows.")

    @field_validator("link", mode="before")
    @classmethod
    def link_known(cls, v):
        return one_of(v, AppLink, "Pick the page the button opens.")

    @field_validator("title")
    @classmethod
    def title_given(cls, v: str) -> str:
        if not v:
            raise ValueError("Enter a title.")
        if len(v) > TITLE_MAX:
            raise ValueError(f"Keep the title to {TITLE_MAX} characters.")
        return v

    @field_validator("button_text")
    @classmethod
    def button_given(cls, v: str) -> str:
        if not v:
            raise ValueError("Enter the button text.")
        return v

    @field_validator("starts_on", mode="before")
    @classmethod
    def start_given(cls, v):
        if not v:
            raise ValueError("Pick a start date.")
        return v

    @field_validator("ends_on", "image_url", "desktop_image_url", mode="before")
    @classmethod
    def empty_is_missing(cls, v):
        return v or None

    @field_validator("image_url", "desktop_image_url")
    @classmethod
    def image_looks_right(cls, v: str | None) -> str | None:
        return image_address(v)

    @model_validator(mode="after")
    def dates_in_order(self) -> "BannerIn":
        if self.ends_on and self.ends_on < self.starts_on:
            raise ValueError("The end date is before the start date.")
        return self


class BannerOut(CamelModel):
    id: str
    placement: Placement
    title: str
    subtitle: str
    button_text: str
    link: AppLink
    image_url: str | None
    desktop_image_url: str | None
    starts_on: dt.date
    ends_on: dt.date | None
    paused: bool
    status: Literal["live", "scheduled", "paused", "ended"] = "live"  # worked out from the dates and paused


class BannerOrderIn(CamelModel):
    """PUT /admin/banners/order: one placement's banners, in their new order."""

    placement: Placement
    ids: list[str]


# ── Gallery ──


class GalleryCategoryOut(CamelModel):
    id: str
    name: str
    photo_count: int = 0


class GalleryPhotoOut(CamelModel):
    id: str
    image_url: str
    caption: str
    category_id: str
    pet: str
    visible: bool


class GalleryOut(CamelModel):
    """GET /admin/gallery: categories, and photos in display order."""

    categories: list[GalleryCategoryOut]
    photos: list[GalleryPhotoOut]


class NewPhotoIn(CamelModel):
    """POST /admin/gallery: a photo just uploaded (it starts hidden)."""

    model_config = ConfigDict(str_strip_whitespace=True)

    image_url: str = ""
    category_id: str = ""
    caption: str = ""

    @field_validator("image_url")
    @classmethod
    def image_looks_right(cls, v: str) -> str:
        return image_address(v) or ""


class PhotoIn(CamelModel):
    """PUT /admin/gallery/{id}: its caption, category, pet and whether the app shows it."""

    model_config = ConfigDict(str_strip_whitespace=True)

    caption: str = ""
    category_id: str = ""
    pet: str = ""
    visible: bool = False


class BulkIn(CamelModel):
    """POST /admin/gallery/bulk: one action on several photos."""

    action: Literal["show", "hide", "delete", "move"]
    ids: list[str]
    category_id: str | None = None


class CategoryIn(CamelModel):
    id: str | None = None  # none for a new category
    name: str = ""


class CategoriesIn(CamelModel):
    """PUT /admin/gallery/categories: the whole list, in order."""

    categories: list[CategoryIn]


class OrderIn(CamelModel):
    ids: list[str]


# ── Pages & FAQs ──


class PageSection(CamelModel):
    id: str = ""
    kind: str = "Text"  # what the section is on the page, e.g. "How it works"; added sections are "Text"
    heading: str = ""
    body: str = ""  # plain text; a blank line starts a new paragraph
    visible: bool = True
    fixed: bool = False  # part of the app's page layout: can be hidden, not removed


class SitePageOut(CamelModel):
    key: Literal["home", "about", "terms", "privacy"]
    title: str
    sections: list[PageSection]  # what customers see now
    draft: list[PageSection] | None  # saved, not published yet
    published_at: dt.datetime
    published_by: str
    draft_saved_at: dt.datetime | None
    draft_saved_by: str | None


class DraftIn(CamelModel):
    sections: list[PageSection]


class FaqGroupOut(CamelModel):
    id: str
    name: str
    shown_on: str


class FaqOut(CamelModel):
    id: str
    group_id: str
    question: str
    answer: str


class FaqData(CamelModel):
    """GET /admin/faqs: groups, and questions in display order."""

    groups: list[FaqGroupOut]
    faqs: list[FaqOut]


class FaqIn(CamelModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    group_id: str = ""
    question: str = ""
    answer: str = ""

    @field_validator("question")
    @classmethod
    def question_given(cls, v: str) -> str:
        if not v:
            raise ValueError("Enter the question.")
        return v

    @field_validator("answer")
    @classmethod
    def answer_given(cls, v: str) -> str:
        if not v:
            raise ValueError("Enter the answer.")
        return v


class FaqOrderIn(CamelModel):
    group_id: str
    ids: list[str]


# ── The customer app (public: only what customers may see) ──


class PublicBannerOut(CamelModel):
    id: str
    placement: Placement
    title: str
    subtitle: str
    button_text: str
    link: AppLink
    image_url: str | None
    desktop_image_url: str | None


class PublicCategory(CamelModel):
    id: str
    name: str


class PublicPhoto(CamelModel):
    id: str
    image_url: str
    caption: str
    category_id: str
    pet: str


class PublicGallery(CamelModel):
    categories: list[PublicCategory]  # only those with photos to show
    photos: list[PublicPhoto]


class PublicSection(CamelModel):
    id: str
    heading: str
    body: str


class PublicPage(CamelModel):
    """A page's published words: visible sections only, never the draft or who wrote it."""

    key: str
    title: str
    sections: list[PublicSection]


class PublicFaqs(CamelModel):
    groups: list[FaqGroupOut]
    faqs: list[FaqOut]
