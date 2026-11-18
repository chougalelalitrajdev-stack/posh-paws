"""Membership plans: unique names, the services a session covers, and one "Most popular" plan."""

from fastapi import HTTPException
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.grooming.catalog.service import known_service_ids
from app.grooming.plans.models import Plan
from app.grooming.plans.schemas import PlanIn


def list_plans(db: Session) -> list[Plan]:
    return list(db.scalars(select(Plan).order_by(Plan.sort_order)))


def find_plan(db: Session, plan_id: str) -> Plan:
    plan = db.get(Plan, plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found.")
    return plan


def _checked(db: Session, body: PlanIn, plan_id: str | None = None) -> dict:
    if db.scalar(select(Plan.id).where(func.lower(Plan.name) == body.name.lower(), Plan.id != plan_id)):
        raise HTTPException(status_code=409, detail="Another plan already has this name.")
    return body.model_dump() | {"eligible_service_ids": known_service_ids(db, body.eligible_service_ids)}


def _only_one_featured(db: Session, plan: Plan) -> None:
    """Only one plan carries the "Most popular" badge, so featuring one takes it off the others."""
    if plan.featured:
        db.execute(update(Plan).where(Plan.id != plan.id).values(featured=False))


def create_plan(db: Session, body: PlanIn) -> Plan:
    last = db.scalar(select(func.max(Plan.sort_order)))
    plan = Plan(**_checked(db, body), sort_order=0 if last is None else last + 1)
    db.add(plan)
    db.flush()  # gives the new plan its id before the others are updated
    _only_one_featured(db, plan)
    db.commit()
    return plan


def update_plan(db: Session, plan: Plan, body: PlanIn) -> Plan:
    """New subscribers get the saved plan straight away; current members pick it up at their next renewal."""
    for field, value in _checked(db, body, plan.id).items():
        setattr(plan, field, value)
    _only_one_featured(db, plan)
    db.commit()
    return plan
