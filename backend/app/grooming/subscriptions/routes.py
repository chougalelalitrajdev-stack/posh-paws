"""Memberships (/admin/subscriptions). Everyone sees them and sends links; plan changes are Super Admin and Admin."""

from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.schemas import Paged
from app.grooming.subscriptions import service
from app.grooming.subscriptions.schemas import AppJoinIn, AppMembershipOut, PlanChangeIn, PlanOption, SubscriptionOut, SubscriptionSummary
from app.shared.customer_login.service import current_customer
from app.shared.customers.models import Customer
from app.shared.staff.models import StaffUser
from app.shared.staff.service import PLAN_CHANGE_ROLES, current_staff, require_roles

router = APIRouter(prefix="/admin/subscriptions", tags=["memberships"])
app_router = APIRouter(prefix="/subscriptions", tags=["customer app"])


@router.get("", response_model=Paged[SubscriptionOut])
def subscriptions(
    tab: Literal["all", "active", "renewing", "pending", "ended"] = "all",
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=10_000, alias="pageSize"),
    db: Session = Depends(get_db),
    _: StaffUser = Depends(current_staff),
) -> Paged[SubscriptionOut]:
    return service.list_subscriptions(db, tab, page, page_size)


@router.get("/summary", response_model=SubscriptionSummary)
def summary(db: Session = Depends(get_db), _: StaffUser = Depends(current_staff)) -> SubscriptionSummary:
    return service.summary(db)


@router.post("/{subscription_id}/payment-link", response_model=SubscriptionOut)
def payment_link(subscription_id: str, db: Session = Depends(get_db), _: StaffUser = Depends(current_staff)) -> SubscriptionOut:
    return service.payment_link(db, service.find_subscription(db, subscription_id))


@router.post("/{subscription_id}/demo-pay", response_model=SubscriptionOut)
def demo_pay(subscription_id: str, db: Session = Depends(get_db), _: StaffUser = Depends(current_staff)) -> SubscriptionOut:
    """Until the payment gateway is connected (Module 12): pretend the customer paid the open link."""
    return service.pay_link(db, service.find_subscription(db, subscription_id))


@router.get("/{subscription_id}/plan-options", response_model=list[PlanOption])
def plan_options(subscription_id: str, db: Session = Depends(get_db), _: StaffUser = Depends(current_staff)) -> list[PlanOption]:
    return service.plan_options(db, service.find_subscription(db, subscription_id))


@router.post("/{subscription_id}/change-plan", response_model=SubscriptionOut)
def change_plan(subscription_id: str, body: PlanChangeIn, db: Session = Depends(get_db),
                me: StaffUser = Depends(require_roles(*PLAN_CHANGE_ROLES))) -> SubscriptionOut:
    return service.change_plan(db, service.find_subscription(db, subscription_id), body, me.name)


# ── The customer app: the logged-in customer's own plan ──


@app_router.get("/current", response_model=AppMembershipOut | None)
def my_membership(db: Session = Depends(get_db), me: Customer = Depends(current_customer)) -> AppMembershipOut | None:
    return service.my_membership(db, me.id)


@app_router.post("", response_model=AppMembershipOut)
def join(body: AppJoinIn, db: Session = Depends(get_db), me: Customer = Depends(current_customer)) -> AppMembershipOut:
    return service.join_in_app(db, me.id, body.plan_id)
