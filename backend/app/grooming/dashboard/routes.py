"""The Today screen (/admin/dashboard), for every signed-in staff member."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.grooming.dashboard import service
from app.grooming.dashboard.schemas import DashboardOut
from app.shared.staff.models import StaffUser
from app.shared.staff.service import current_staff

router = APIRouter(prefix="/admin/dashboard", tags=["today"])


@router.get("", response_model=DashboardOut)
def dashboard(db: Session = Depends(get_db), _: StaffUser = Depends(current_staff)) -> DashboardOut:
    return service.summary(db)
