"""Customer app content: /admin/banners, /admin/gallery, /admin/pages, /admin/faqs.
Every staff member sees it; Admin and Super Admin change it."""

from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.shared.content import service
from app.shared.content.schemas import (
    BannerIn, BannerOrderIn, BannerOut, BulkIn, CategoriesIn, DraftIn, FaqData, FaqIn, FaqOrderIn, FaqOut, GalleryOut, GalleryPhotoOut,
    NewPhotoIn, OrderIn, PhotoIn, PublicBannerOut, PublicFaqs, PublicGallery, PublicPage, SitePageOut,
)
from app.shared.staff.models import StaffUser
from app.shared.staff.service import CATALOG_EDIT_ROLES, current_staff, require_roles

banner_router = APIRouter(prefix="/admin/banners", tags=["content"])
gallery_router = APIRouter(prefix="/admin/gallery", tags=["content"])
page_router = APIRouter(prefix="/admin/pages", tags=["content"])
faq_router = APIRouter(prefix="/admin/faqs", tags=["content"])
public_router = APIRouter(tags=["customer app"])

editors = require_roles(*CATALOG_EDIT_ROLES)

# ── Banners ──


@banner_router.get("", response_model=list[BannerOut])
def banners(db: Session = Depends(get_db), _: StaffUser = Depends(current_staff)) -> list[BannerOut]:
    return [service.banner_out(b) for b in service.list_banners(db)]


@banner_router.post("", response_model=BannerOut)
def add_banner(body: BannerIn, db: Session = Depends(get_db), _: StaffUser = Depends(editors)) -> BannerOut:
    return service.save_banner(db, None, body)


@banner_router.put("/order", response_model=list[BannerOut])  # before /{banner_id}
def reorder_banners(body: BannerOrderIn, db: Session = Depends(get_db), _: StaffUser = Depends(editors)) -> list[BannerOut]:
    return service.reorder_banners(db, body.placement, body.ids)


@banner_router.put("/{banner_id}", response_model=BannerOut)
def edit_banner(banner_id: str, body: BannerIn, db: Session = Depends(get_db), _: StaffUser = Depends(editors)) -> BannerOut:
    return service.save_banner(db, service.find_banner(db, banner_id), body)


@banner_router.post("/{banner_id}/pause", response_model=BannerOut)
def pause(banner_id: str, db: Session = Depends(get_db), _: StaffUser = Depends(editors)) -> BannerOut:
    return service.set_paused(db, service.find_banner(db, banner_id), True)


@banner_router.post("/{banner_id}/resume", response_model=BannerOut)
def resume(banner_id: str, db: Session = Depends(get_db), _: StaffUser = Depends(editors)) -> BannerOut:
    return service.set_paused(db, service.find_banner(db, banner_id), False)


@banner_router.delete("/{banner_id}", status_code=204)
def remove_banner(banner_id: str, db: Session = Depends(get_db), _: StaffUser = Depends(editors)) -> Response:
    service.remove_banner(db, service.find_banner(db, banner_id))
    return Response(status_code=204)


# ── Gallery ──


@gallery_router.get("", response_model=GalleryOut)
def gallery(db: Session = Depends(get_db), _: StaffUser = Depends(current_staff)) -> GalleryOut:
    return service.gallery(db)


@gallery_router.post("", response_model=GalleryPhotoOut)
def add_photo(body: NewPhotoIn, db: Session = Depends(get_db), _: StaffUser = Depends(editors)) -> GalleryPhotoOut:
    return service.add_photo(db, body)


# Fixed paths before /{photo_id}.
@gallery_router.put("/order", response_model=GalleryOut)
def reorder_photos(body: OrderIn, db: Session = Depends(get_db), _: StaffUser = Depends(editors)) -> GalleryOut:
    return service.reorder_photos(db, body.ids)


@gallery_router.post("/bulk", response_model=GalleryOut)
def bulk(body: BulkIn, db: Session = Depends(get_db), _: StaffUser = Depends(editors)) -> GalleryOut:
    return service.bulk(db, body)


@gallery_router.put("/categories", response_model=GalleryOut)
def categories(body: CategoriesIn, db: Session = Depends(get_db), _: StaffUser = Depends(editors)) -> GalleryOut:
    return service.save_categories(db, body.categories)


@gallery_router.put("/{photo_id}", response_model=GalleryPhotoOut)
def edit_photo(photo_id: str, body: PhotoIn, db: Session = Depends(get_db), _: StaffUser = Depends(editors)) -> GalleryPhotoOut:
    return service.update_photo(db, photo_id, body)


# ── Pages ──


@page_router.get("", response_model=list[SitePageOut])
def pages(db: Session = Depends(get_db), _: StaffUser = Depends(current_staff)) -> list[SitePageOut]:
    return service.list_pages(db)


@page_router.put("/{key}/draft", response_model=SitePageOut)
def save_draft(key: str, body: DraftIn, db: Session = Depends(get_db), me: StaffUser = Depends(editors)) -> SitePageOut:
    return service.save_draft(db, service.find_page(db, key), body.sections, me.name)


@page_router.delete("/{key}/draft", response_model=SitePageOut)
def discard_draft(key: str, db: Session = Depends(get_db), _: StaffUser = Depends(editors)) -> SitePageOut:
    return service.discard_draft(db, service.find_page(db, key))


@page_router.post("/{key}/publish", response_model=SitePageOut)
def publish(key: str, db: Session = Depends(get_db), me: StaffUser = Depends(editors)) -> SitePageOut:
    """Customers see the draft from now on."""
    return service.publish(db, service.find_page(db, key), me.name)


# ── FAQs ──


@faq_router.get("", response_model=FaqData)
def faqs(db: Session = Depends(get_db), _: StaffUser = Depends(current_staff)) -> FaqData:
    return service.faq_data(db)


@faq_router.post("", response_model=FaqOut)
def add_faq(body: FaqIn, db: Session = Depends(get_db), _: StaffUser = Depends(editors)) -> FaqOut:
    return service.save_faq(db, None, body)


@faq_router.put("/order", response_model=FaqData)  # before /{faq_id}
def reorder_faqs(body: FaqOrderIn, db: Session = Depends(get_db), _: StaffUser = Depends(editors)) -> FaqData:
    return service.reorder_faqs(db, body.group_id, body.ids)


@faq_router.put("/{faq_id}", response_model=FaqOut)
def edit_faq(faq_id: str, body: FaqIn, db: Session = Depends(get_db), _: StaffUser = Depends(editors)) -> FaqOut:
    return service.save_faq(db, service.find_faq(db, faq_id), body)


@faq_router.delete("/{faq_id}", status_code=204)
def remove_faq(faq_id: str, db: Session = Depends(get_db), _: StaffUser = Depends(editors)) -> Response:
    service.remove_faq(db, service.find_faq(db, faq_id))
    return Response(status_code=204)


# ── The customer app (no login needed) ──


@public_router.get("/banners", response_model=list[PublicBannerOut])
def public_banners(db: Session = Depends(get_db)) -> list[PublicBannerOut]:
    return service.public_banners(db)


@public_router.get("/gallery", response_model=PublicGallery)
def public_gallery(db: Session = Depends(get_db)) -> PublicGallery:
    return service.public_gallery(db)


@public_router.get("/pages/{key}", response_model=PublicPage)
def public_page(key: str, db: Session = Depends(get_db)) -> PublicPage:
    return service.public_page(db, key)


@public_router.get("/faqs", response_model=PublicFaqs)
def public_faqs(db: Session = Depends(get_db)) -> PublicFaqs:
    return service.public_faqs(db)
