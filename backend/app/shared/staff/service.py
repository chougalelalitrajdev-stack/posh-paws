"""Who is signed in, what each role may do, and the team rules."""

from datetime import datetime, timezone

from fastapi import Depends, Header, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import create_token, hash_password, read_token, verify_password
from app.shared.staff.models import StaffUser
from app.shared.staff.schemas import InviteIn

# ── The permissions list: which roles may do what. Same groups as the admin app (core/constants/app.constants.ts). ──
SETTINGS_ROLES = ("super_admin", "admin")  # Settings, the usual week, stations
CATALOG_EDIT_ROLES = ("super_admin", "admin")  # services, plans, offers, banners, gallery, pages
PLAN_CHANGE_ROLES = ("super_admin", "admin")  # changing a customer's plan
OWNER_ROLES = ("super_admin",)  # Team & roles, refunds

WRONG_LOGIN = "That email and password don't match. Check them and try again, or reset your password."


# ── Signing in ──


def sign_in(db: Session, email: str, password: str) -> tuple[StaffUser, str]:
    """The account and a fresh token. A wrong email and a wrong password get the same answer, so emails can't be probed."""
    staff = db.scalar(select(StaffUser).where(StaffUser.email == email.strip().lower()))
    if not staff or staff.status != "active" or not verify_password(password, staff.password_hash):
        raise HTTPException(status_code=401, detail=WRONG_LOGIN)
    staff.last_seen_at = datetime.now(timezone.utc)
    db.commit()
    return staff, create_token({"sub": staff.id, "name": staff.name, "email": staff.email, "role": staff.role})


def current_staff(authorization: str | None = Header(default=None), db: Session = Depends(get_db)) -> StaffUser:
    """Use as Depends(current_staff): the signed-in person, or 401 so the admin shows the sign-in page."""
    claims = read_token(authorization.removeprefix("Bearer ").strip()) if authorization else None
    staff = db.get(StaffUser, claims["sub"]) if claims else None
    if not staff or staff.status != "active":
        raise HTTPException(status_code=401, detail="Please sign in.")
    return staff


def require_roles(*roles: str):
    """Use as Depends(require_roles(*SETTINGS_ROLES)): the signed-in person if their role is allowed, otherwise 403."""

    def check(staff: StaffUser = Depends(current_staff)) -> StaffUser:
        if staff.role not in roles:
            raise HTTPException(status_code=403, detail="You don't have access to this.")
        return staff

    return check


# ── Team & roles (Super Admin) ──


def list_team(db: Session) -> list[StaffUser]:
    return list(db.scalars(select(StaffUser).order_by(StaffUser.created_at, StaffUser.name)))


def invite(db: Session, body: InviteIn) -> StaffUser:
    """Adds someone as invited. They can sign in once they've set a password (sent by email in a later module)."""
    if db.scalar(select(StaffUser).where(StaffUser.email == body.email)):
        raise HTTPException(status_code=409, detail="Someone on the team already uses that email.")
    member = StaffUser(name=body.name, email=body.email, role=body.role, status="invited")
    db.add(member)
    db.commit()
    return member


def find_member(db: Session, member_id: str) -> StaffUser:
    member = db.get(StaffUser, member_id)
    if not member:
        raise HTTPException(status_code=404, detail="Team member not found.")
    return member


def _another_owner(db: Session, member: StaffUser) -> bool:
    return db.scalar(
        select(StaffUser.id).where(StaffUser.id != member.id, StaffUser.role == "super_admin", StaffUser.status == "active").limit(1)
    ) is not None


def set_role(db: Session, me: StaffUser, member: StaffUser, role: str) -> StaffUser:
    """Nobody changes their own role, and there is always at least one active Super Admin."""
    if member.id == me.id:
        raise HTTPException(status_code=409, detail="You can't change your own role. Ask another Super Admin.")
    if member.role == "super_admin" and role != "super_admin" and not _another_owner(db, member):
        raise HTTPException(status_code=409, detail="Keep at least one Super Admin.")
    member.role = role
    db.commit()
    return member


def remove(db: Session, me: StaffUser, member: StaffUser) -> None:
    if member.id == me.id:
        raise HTTPException(status_code=409, detail="You can't remove yourself.")
    if member.role == "super_admin" and not _another_owner(db, member):
        raise HTTPException(status_code=409, detail="Keep at least one Super Admin.")
    db.delete(member)
    db.commit()


def create_staff(db: Session, name: str, email: str, role: str, password: str) -> StaffUser:
    """An active account with a password (the seed script and, at launch, the first real accounts)."""
    staff = StaffUser(name=name, email=email.strip().lower(), role=role, status="active", password_hash=hash_password(password))
    db.add(staff)
    db.commit()
    return staff
