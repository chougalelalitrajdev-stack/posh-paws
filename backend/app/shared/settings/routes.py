"""Settings (/admin/settings), holidays (/admin/settings/closures) and the usual week (/admin/slot-board/week)."""

from fastapi import APIRouter, Depends, Path
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.shared.settings import service
from app.shared.settings.schemas import (
    AppSettings, BookingRules, BusinessSettings, ClosureIn, ClosureOut, NotificationSettings, PaymentSettings,
    SettingsOut, ShopOut, WeekBoardOut, WeekSlotIn,
)
from app.shared.staff.models import StaffUser
from app.shared.staff.service import SETTINGS_ROLES, current_staff, require_roles

router = APIRouter(prefix="/admin/settings", tags=["settings"])
week_router = APIRouter(prefix="/admin/slot-board/week", tags=["availability"])
shop_router = APIRouter(prefix="/shop", tags=["customer app"])

admins = require_roles(*SETTINGS_ROLES)


@router.get("", response_model=SettingsOut)
def read(db: Session = Depends(get_db), _: StaffUser = Depends(current_staff)) -> SettingsOut:
    """Every signed-in staff member can read the settings (screens show the advance, the rules, the shop's UPI ID)."""
    return service.all_settings(db)


# One address per section, so each gets its own checks. Admin and Super Admin only.
@router.put("/business", response_model=SettingsOut)
def save_business(body: BusinessSettings, db: Session = Depends(get_db), me: StaffUser = Depends(admins)) -> SettingsOut:
    return service.save_section(db, "business", body, me.name)


@router.put("/booking", response_model=SettingsOut)
def save_booking(body: BookingRules, db: Session = Depends(get_db), me: StaffUser = Depends(admins)) -> SettingsOut:
    return service.save_section(db, "booking", body, me.name)


@router.put("/payments", response_model=SettingsOut)
def save_payments(body: PaymentSettings, db: Session = Depends(get_db), me: StaffUser = Depends(admins)) -> SettingsOut:
    return service.save_section(db, "payments", body, me.name)


@router.put("/notifications", response_model=SettingsOut)
def save_notifications(body: NotificationSettings, db: Session = Depends(get_db), me: StaffUser = Depends(admins)) -> SettingsOut:
    return service.save_section(db, "notifications", body, me.name)


@router.put("/app", response_model=SettingsOut)
def save_app(body: AppSettings, db: Session = Depends(get_db), me: StaffUser = Depends(admins)) -> SettingsOut:
    return service.save_section(db, "app", body, me.name)


# Holidays are day-to-day running (Availability › Holidays), so any staff member may change them.
@router.post("/closures", response_model=ClosureOut)
def add_closure(body: ClosureIn, db: Session = Depends(get_db), _: StaffUser = Depends(current_staff)) -> ClosureOut:
    return service.add_closure(db, body)


@router.delete("/closures/{closure_id}", response_model=SettingsOut)
def remove_closure(closure_id: str, db: Session = Depends(get_db), _: StaffUser = Depends(current_staff)) -> SettingsOut:
    return service.remove_closure(db, closure_id)


@week_router.get("", response_model=WeekBoardOut)
def week(db: Session = Depends(get_db), _: StaffUser = Depends(current_staff)) -> WeekBoardOut:
    return service.week_board(db)


@week_router.put("/{weekday}", response_model=WeekBoardOut)
def set_week_slot(body: WeekSlotIn, weekday: int = Path(ge=0, le=6), db: Session = Depends(get_db), me: StaffUser = Depends(admins)) -> WeekBoardOut:
    """The usual week is the business's hours: Admin and Super Admin."""
    return service.set_week_slot(db, weekday, body.time, body.open, me.name)


@shop_router.get("", response_model=ShopOut)
def shop(db: Session = Depends(get_db)) -> ShopOut:
    """The advance, the free-cancellation window and the shop's UPI details (no login needed)."""
    p = service.get_section(db, "payments")
    return ShopOut(advance_paise=p.slot_hold_paise, free_cancellation_hours=p.free_cancellation_hours, upi_id=p.upi_id, qr_image_url=p.qr_image_url)
