"""Catalog › Pet pricing (/admin/pet-pricing) and the customer app's pet form choices (/pet-options, no login)."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.grooming.pet_pricing import service
from app.grooming.pet_pricing.schemas import PetOptionsOut, PetPricingDoc
from app.shared.staff.models import StaffUser
from app.shared.staff.service import CATALOG_EDIT_ROLES, current_staff, require_roles

router = APIRouter(prefix="/admin/pet-pricing", tags=["pet pricing"])
public_router = APIRouter(prefix="/pet-options", tags=["customer app"])


@router.get("", response_model=PetPricingDoc)
def pricing(db: Session = Depends(get_db), _: StaffUser = Depends(current_staff)) -> PetPricingDoc:
    """Every staff member reads it: the pet forms take their breed list from here."""
    return service.pricing(db)


@router.put("", response_model=PetPricingDoc)
def save(body: PetPricingDoc, db: Session = Depends(get_db), me: StaffUser = Depends(require_roles(*CATALOG_EDIT_ROLES))) -> PetPricingDoc:
    return service.save_pricing(db, body, me.name)


@public_router.get("", response_model=PetOptionsOut)
def pet_options(db: Session = Depends(get_db)) -> PetOptionsOut:
    return service.pet_options(db)
