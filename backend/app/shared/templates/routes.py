"""Message templates (/admin/templates): every staff member reads them; Admin and Super Admin edit them."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.shared.staff.models import StaffUser
from app.shared.staff.service import CATALOG_EDIT_ROLES, current_staff, require_roles
from app.shared.templates import service
from app.shared.templates.schemas import TemplateIn, TemplateOut

router = APIRouter(prefix="/admin/templates", tags=["message templates"])


@router.get("", response_model=list[TemplateOut])
def read(db: Session = Depends(get_db), _: StaffUser = Depends(current_staff)) -> list[TemplateOut]:
    return service.list_templates(db)


@router.put("/{key}", response_model=TemplateOut)
def save(key: str, body: TemplateIn, db: Session = Depends(get_db), me: StaffUser = Depends(require_roles(*CATALOG_EDIT_ROLES))) -> TemplateOut:
    return service.update(db, key, body, me.name)
