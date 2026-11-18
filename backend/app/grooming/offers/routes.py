"""Offers (/admin/offers): every staff member reads them; Admin and Super Admin change them."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.grooming.offers import service
from app.grooming.offers.schemas import OfferIn, OfferOut
from app.shared.staff.models import StaffUser
from app.shared.staff.service import CATALOG_EDIT_ROLES, current_staff, require_roles

router = APIRouter(prefix="/admin/offers", tags=["offers"])

editors = require_roles(*CATALOG_EDIT_ROLES)


@router.get("", response_model=list[OfferOut])
def offers(db: Session = Depends(get_db), _: StaffUser = Depends(current_staff)) -> list[OfferOut]:
    return service.list_offers(db)


@router.post("", response_model=OfferOut)
def add_offer(body: OfferIn, db: Session = Depends(get_db), _: StaffUser = Depends(editors)) -> OfferOut:
    return service.create_offer(db, body)


@router.put("/{offer_id}", response_model=OfferOut)
def edit_offer(offer_id: str, body: OfferIn, db: Session = Depends(get_db), _: StaffUser = Depends(editors)) -> OfferOut:
    return service.update_offer(db, service.find_offer(db, offer_id), body)


@router.post("/{offer_id}/pause", response_model=OfferOut)
def pause(offer_id: str, db: Session = Depends(get_db), _: StaffUser = Depends(editors)) -> OfferOut:
    return service.set_paused(db, service.find_offer(db, offer_id), True)


@router.post("/{offer_id}/resume", response_model=OfferOut)
def resume(offer_id: str, db: Session = Depends(get_db), _: StaffUser = Depends(editors)) -> OfferOut:
    return service.set_paused(db, service.find_offer(db, offer_id), False)
