"""Banners, gallery, page words (draft → publish) and FAQs. The pages, FAQ groups and gallery categories the app is built
around exist from the start (added the first time they're read); banners, photos and questions are added by staff."""

import datetime as dt

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.dates import today
from app.shared.content.models import Banner, Faq, FaqGroup, GalleryCategory, GalleryPhoto, SitePage
from app.shared.content.schemas import (
    BannerIn, BannerOut, BulkIn, CategoryIn, FaqData, FaqGroupOut, FaqIn, FaqOut, GalleryCategoryOut, GalleryOut, GalleryPhotoOut,
    NewPhotoIn, PageSection, PhotoIn, SitePageOut,
)

LIST_CHANGED = "The list changed. Reload and try again."
MAX_SECTION = 4000

# The customer app's starting words, pages and groups: real content, not demo data.
_STORY = ("Posh Paws was born from a simple belief: every pet deserves the same quality of care their owner gives themselves. We started in a "
          "small studio in Koregaon Park and have grown into Pune’s most trusted grooming sanctuary, one happy pet at a time.\n\n"
          "Our groomers are certified professionals who genuinely love animals. We use only imported, pet-safe, sulphate-free products: "
          "nothing harsh, nothing that doesn’t belong near your companion.")
_VALUES = ("Only safe products. Imported, organic, sulphate-free formulas.\n\nCertified groomers. Every groomer on our team is trained, "
           "certified and passionate about animal welfare.\n\nFear-free approach. We move at your pet’s pace. Calm handling, gentle "
           "techniques, no rush.\n\nHonest pricing. No hidden fees, no surprise add-ons.")
DEFAULT_PAGES = {
    "home": ("Home page", [
        ("home-hero", "Hero (the image comes from Banners)", "Your pet deserves only the finest.",
         "Premium grooming rituals crafted with love, for cats and dogs. By appointment, because your pet’s time matters too.", True),
        ("home-services", "Services (cards come from Services)", "Grooming rituals for every pet", "", True),
        ("home-plans", "Membership (cards come from Membership plans)", "Choose your plan", "", True),
        ("home-story", "Our story", "Six years of caring for Pune’s pets", _STORY, True),
        ("home-gallery", "Gallery (photos come from Gallery)", "Happy pets, every time", "", True),
        ("home-reviews", "Testimonials", "What pet parents say", "", True),
    ]),
    "about": ("About", [
        ("about-intro", "Our story", "Six years of caring for Pune’s pets", _STORY, True),
        ("about-values", "Values", "The values behind every session", _VALUES, True),
        ("about-team", "Team", "Meet the groomers", "[Your groomers’ names]", False),
    ]),
    "terms": ("Terms of service", [("terms-body", "Body", "Terms of service", "[Your terms of service]", True)]),
    "privacy": ("Privacy policy", [("privacy-body", "Body", "Privacy policy", "[Your privacy policy]", True)]),
}
DEFAULT_FAQ_GROUPS = [("fg-booking", "Booking", "Services, Booking"), ("fg-membership", "Membership", "Membership"),
                      ("fg-pets", "Pets and safety", "About, Services")]
DEFAULT_CATEGORIES = [("gc-grooming", "Grooming"), ("gc-before-after", "Before & after"), ("gc-happy", "Happy pets"),
                      ("gc-studio", "Studio"), ("gc-events", "Events")]


def _utc_now() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


def _next_place(db: Session, model, last: bool = True) -> int:
    """A position after the last item (or before the first)."""
    edge = db.scalar(select(func.max(model.sort_order) if last else func.min(model.sort_order)))
    return 0 if edge is None else edge + 1 if last else edge - 1


def _reorder_subset(items: list, ids: list[str]) -> None:
    """Puts these items, in the order given, into the places they already fill (one placement's banners inside the whole list)."""
    if sorted(ids) != sorted(i.id for i in items) or len(set(ids)) != len(ids):
        raise HTTPException(status_code=400, detail=LIST_CHANGED)
    places = sorted(i.sort_order for i in items)
    by_id = {i.id: i for i in items}
    for place, item_id in zip(places, ids):
        by_id[item_id].sort_order = place


# ── Banners ──


def banner_status(b: Banner) -> str:
    t = today()
    if b.ends_on and b.ends_on < t:
        return "ended"
    if b.paused:
        return "paused"
    return "scheduled" if b.starts_on > t else "live"


def banner_out(b: Banner) -> BannerOut:
    return BannerOut.model_validate(b).model_copy(update={"status": banner_status(b)})


def list_banners(db: Session) -> list[Banner]:
    return list(db.scalars(select(Banner).order_by(Banner.sort_order)))


def find_banner(db: Session, banner_id: str) -> Banner:
    b = db.get(Banner, banner_id)
    if not b:
        raise HTTPException(status_code=404, detail="Banner not found.")
    return b


def save_banner(db: Session, b: Banner | None, body: BannerIn) -> BannerOut:
    """Create (no banner) or update. A new banner goes last."""
    if not b:
        b = Banner(sort_order=_next_place(db, Banner), paused=False)
        db.add(b)
    for field, value in body.model_dump().items():
        setattr(b, field, value)
    db.commit()
    return banner_out(b)


def reorder_banners(db: Session, placement: str, ids: list[str]) -> list[BannerOut]:
    _reorder_subset([b for b in list_banners(db) if b.placement == placement], ids)
    db.commit()
    return [banner_out(b) for b in list_banners(db)]


def set_paused(db: Session, b: Banner, paused: bool) -> BannerOut:
    b.paused = paused
    db.commit()
    return banner_out(b)


def remove_banner(db: Session, b: Banner) -> None:
    db.delete(b)
    db.commit()


def shown_banners(db: Session) -> list[Banner]:
    """What the customer app shows: the first live banner in each placement."""
    shown: dict[str, Banner] = {}
    for b in list_banners(db):
        if banner_status(b) == "live":
            shown.setdefault(b.placement, b)
    return list(shown.values())


# ── Gallery ──


def _ensure_categories(db: Session) -> None:
    if db.scalar(select(GalleryCategory.id).limit(1)) is None:
        db.add_all(GalleryCategory(id=cid, name=name, sort_order=i) for i, (cid, name) in enumerate(DEFAULT_CATEGORIES))
        db.commit()


def gallery(db: Session) -> GalleryOut:
    _ensure_categories(db)
    photos = list(db.scalars(select(GalleryPhoto).order_by(GalleryPhoto.sort_order)))
    return GalleryOut(
        categories=[GalleryCategoryOut(id=c.id, name=c.name, photo_count=sum(p.category_id == c.id for p in photos))
                    for c in db.scalars(select(GalleryCategory).order_by(GalleryCategory.sort_order))],
        photos=[GalleryPhotoOut.model_validate(p) for p in photos],
    )


def _find_photo(db: Session, photo_id: str) -> GalleryPhoto:
    p = db.get(GalleryPhoto, photo_id)
    if not p:
        raise HTTPException(status_code=404, detail="Photo not found.")
    return p


def _check_category(db: Session, category_id: str | None) -> None:
    if not category_id or not db.get(GalleryCategory, category_id):
        raise HTTPException(status_code=400, detail="Pick a category.")


def add_photo(db: Session, body: NewPhotoIn) -> GalleryPhotoOut:
    """New photos go first and start hidden, so they can be captioned before customers see them."""
    if not body.image_url:
        raise HTTPException(status_code=400, detail="Upload a photo first.")
    _check_category(db, body.category_id)
    photo = GalleryPhoto(image_url=body.image_url, caption=body.caption, category_id=body.category_id, pet="", visible=False,
                         sort_order=_next_place(db, GalleryPhoto, last=False))
    db.add(photo)
    db.commit()
    return GalleryPhotoOut.model_validate(photo)


def update_photo(db: Session, photo_id: str, body: PhotoIn) -> GalleryPhotoOut:
    p = _find_photo(db, photo_id)
    _check_category(db, body.category_id)
    if body.visible and not body.caption:
        raise HTTPException(status_code=400, detail="Add a caption before showing the photo in the app.")
    p.caption, p.category_id, p.pet, p.visible = body.caption, body.category_id, body.pet, body.visible
    db.commit()
    return GalleryPhotoOut.model_validate(p)


def bulk(db: Session, body: BulkIn) -> GalleryOut:
    photos = [_find_photo(db, i) for i in body.ids]
    if body.action == "delete":
        for p in photos:
            db.delete(p)
    elif body.action == "move":
        _check_category(db, body.category_id)
        for p in photos:
            p.category_id = body.category_id
    else:
        if body.action == "show" and any(not p.caption for p in photos):
            raise HTTPException(status_code=400, detail="Add a caption to each photo before showing it in the app.")
        for p in photos:
            p.visible = body.action == "show"
    db.commit()
    return gallery(db)


def reorder_photos(db: Session, ids: list[str]) -> GalleryOut:
    _reorder_subset([_find_photo(db, i) for i in ids], ids)
    db.commit()
    return gallery(db)


def save_categories(db: Session, wanted: list[CategoryIn]) -> GalleryOut:
    """Replaces the category list, in the order given. A category can only go once it has no photos."""
    _ensure_categories(db)
    names = [c.name.strip() for c in wanted]
    if any(not n for n in names):
        raise HTTPException(status_code=400, detail="Every category needs a name.")
    if len({n.lower() for n in names}) != len(names):
        raise HTTPException(status_code=400, detail="Two categories have the same name.")
    keep = {c.id for c in wanted if c.id}
    for old in db.scalars(select(GalleryCategory)):
        count = db.scalar(select(func.count()).select_from(GalleryPhoto).where(GalleryPhoto.category_id == old.id))
        if old.id not in keep:
            if count:
                raise HTTPException(status_code=409, detail=f"Move the {count} photo{'' if count == 1 else 's'} in {old.name} to another category first.")
            db.delete(old)
    for i, (c, name) in enumerate(zip(wanted, names)):
        existing = db.get(GalleryCategory, c.id) if c.id else None
        if existing:
            existing.name, existing.sort_order = name, i
        else:
            db.add(GalleryCategory(name=name, sort_order=i))
    db.commit()
    return gallery(db)


# ── Pages ──


def _ensure_pages(db: Session) -> None:
    have = set(db.scalars(select(SitePage.key)))
    for key, (title, sections) in DEFAULT_PAGES.items():
        if key not in have:
            db.add(SitePage(key=key, title=title, published_at=_utc_now(), published_by="Posh Paws", sections=[
                {"id": sid, "kind": kind, "heading": heading, "body": body, "visible": visible, "fixed": True}
                for sid, kind, heading, body, visible in sections
            ]))
    db.commit()


def page_out(p: SitePage) -> SitePageOut:
    return SitePageOut.model_validate(p)


def list_pages(db: Session) -> list[SitePageOut]:
    _ensure_pages(db)
    order = list(DEFAULT_PAGES)
    return sorted((page_out(p) for p in db.scalars(select(SitePage))), key=lambda p: order.index(p.key))


def find_page(db: Session, key: str) -> SitePage:
    _ensure_pages(db)
    p = db.get(SitePage, key)
    if not p:
        raise HTTPException(status_code=404, detail="Page not found.")
    return p


def save_draft(db: Session, p: SitePage, sections: list[PageSection], by: str) -> SitePageOut:
    known = {s["id"]: s for s in p.sections}
    for fixed in (s for s in p.sections if s["fixed"]):
        if not any(s.id == fixed["id"] for s in sections):
            raise HTTPException(status_code=400, detail=f"The {fixed['kind']} section is part of the page. Hide it instead.")
    draft = []
    for i, s in enumerate(sections):
        body = s.body.strip()
        if len(body) > MAX_SECTION:
            raise HTTPException(status_code=400, detail=f"Keep each section under {MAX_SECTION} characters.")
        was = known.get(s.id)
        draft.append({"id": s.id or f"sec-{int(_utc_now().timestamp())}{i}", "kind": was["kind"] if was else "Text", "heading": s.heading.strip(),
                      "body": body, "visible": s.visible, "fixed": was["fixed"] if was else False})
    p.draft, p.draft_saved_at, p.draft_saved_by = draft, _utc_now(), by
    db.commit()
    return page_out(p)


def discard_draft(db: Session, p: SitePage) -> SitePageOut:
    p.draft, p.draft_saved_at, p.draft_saved_by = None, None, None
    db.commit()
    return page_out(p)


def publish(db: Session, p: SitePage, by: str) -> SitePageOut:
    if not p.draft:
        raise HTTPException(status_code=409, detail="There are no draft changes to publish.")
    p.sections, p.published_at, p.published_by = p.draft, _utc_now(), by
    p.draft, p.draft_saved_at, p.draft_saved_by = None, None, None
    db.commit()
    return page_out(p)


# ── FAQs ──


def _ensure_groups(db: Session) -> None:
    if db.scalar(select(FaqGroup.id).limit(1)) is None:
        db.add_all(FaqGroup(id=gid, name=name, shown_on=shown, sort_order=i) for i, (gid, name, shown) in enumerate(DEFAULT_FAQ_GROUPS))
        db.commit()


def faq_data(db: Session) -> FaqData:
    _ensure_groups(db)
    return FaqData(groups=[FaqGroupOut.model_validate(g) for g in db.scalars(select(FaqGroup).order_by(FaqGroup.sort_order))],
                   faqs=[FaqOut.model_validate(f) for f in db.scalars(select(Faq).order_by(Faq.sort_order))])


def find_faq(db: Session, faq_id: str) -> Faq:
    f = db.get(Faq, faq_id)
    if not f:
        raise HTTPException(status_code=404, detail="Question not found.")
    return f


def save_faq(db: Session, f: Faq | None, body: FaqIn) -> FaqOut:
    """Create (no question) or update. New questions, and ones moved to another group, go last in their group."""
    _ensure_groups(db)
    if not db.get(FaqGroup, body.group_id):
        raise HTTPException(status_code=400, detail="Pick a group.")
    if not f or f.group_id != body.group_id:
        place = _next_place(db, Faq)
        if not f:
            f = Faq(sort_order=place)
            db.add(f)
        f.sort_order = place
    f.group_id, f.question, f.answer = body.group_id, body.question, body.answer
    db.commit()
    return FaqOut.model_validate(f)


def remove_faq(db: Session, f: Faq) -> None:
    db.delete(f)
    db.commit()


def reorder_faqs(db: Session, group_id: str, ids: list[str]) -> FaqData:
    _reorder_subset(list(db.scalars(select(Faq).where(Faq.group_id == group_id))), ids)
    db.commit()
    return faq_data(db)
