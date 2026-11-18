"""Sign-in (/admin/auth) and Settings › Team & roles (/admin/team). Thin: check the shape, call service.py, return a shape."""

from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.shared.staff import service
from app.shared.staff.models import StaffUser
from app.shared.staff.schemas import ForgotPasswordIn, InviteIn, LoginIn, LoginOut, RoleIn, StaffOut, TeamMemberOut

auth_router = APIRouter(prefix="/admin/auth", tags=["sign-in"])
team_router = APIRouter(prefix="/admin/team", tags=["team"])

owner = service.require_roles(*service.OWNER_ROLES)


@auth_router.post("/login", response_model=LoginOut)
def login(body: LoginIn, db: Session = Depends(get_db)) -> LoginOut:
    staff, token = service.sign_in(db, body.email, body.password)
    return LoginOut(user=StaffOut.model_validate(staff), token=token)


@auth_router.post("/forgot-password")
def forgot_password(body: ForgotPasswordIn) -> dict:
    """Always answers the same, so it can't be used to find out which emails have accounts. The email itself comes later."""
    return {}


@team_router.get("", response_model=list[TeamMemberOut])
def team(db: Session = Depends(get_db), _: StaffUser = Depends(owner)) -> list[StaffUser]:
    return service.list_team(db)


@team_router.post("", response_model=TeamMemberOut)
def invite(body: InviteIn, db: Session = Depends(get_db), _: StaffUser = Depends(owner)) -> StaffUser:
    return service.invite(db, body)


@team_router.put("/{member_id}", response_model=TeamMemberOut)
def set_role(member_id: str, body: RoleIn, db: Session = Depends(get_db), me: StaffUser = Depends(owner)) -> StaffUser:
    return service.set_role(db, me, service.find_member(db, member_id), body.role)


@team_router.delete("/{member_id}", status_code=204)
def remove(member_id: str, db: Session = Depends(get_db), me: StaffUser = Depends(owner)) -> Response:
    service.remove(db, me, service.find_member(db, member_id))
    return Response(status_code=204)
