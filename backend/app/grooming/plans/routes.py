"""Membership plans (/admin/plans): every staff member reads them; Admin and Super Admin change them."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.grooming.plans import service
from app.grooming.plans.models import Plan
from app.grooming.plans.schemas import PlanIn, PlanOut, PublicPlanOut
from app.shared.staff.models import StaffUser
from app.shared.staff.service import CATALOG_EDIT_ROLES, current_staff, require_roles

router = APIRouter(prefix="/admin/plans", tags=["membership plans"])
public_router = APIRouter(prefix="/plans", tags=["customer app"])

editors = require_roles(*CATALOG_EDIT_ROLES)


@router.get("", response_model=list[PlanOut])
def plans(db: Session = Depends(get_db), _: StaffUser = Depends(current_staff)) -> list[Plan]:
    return service.list_plans(db)


@router.post("", response_model=PlanOut)
def add_plan(body: PlanIn, db: Session = Depends(get_db), _: StaffUser = Depends(editors)) -> Plan:
    return service.create_plan(db, body)


@router.put("/{plan_id}", response_model=PlanOut)
def edit_plan(plan_id: str, body: PlanIn, db: Session = Depends(get_db), _: StaffUser = Depends(editors)) -> Plan:
    return service.update_plan(db, service.find_plan(db, plan_id), body)


@public_router.get("", response_model=list[PublicPlanOut])
def public_plans(db: Session = Depends(get_db)) -> list[PublicPlanOut]:
    """The customer app's membership plans (no login needed)."""
    return service.public_plans(db)
