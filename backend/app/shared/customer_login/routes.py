"""Customer login for the app (/auth/...): public, no token needed. Staff sign in at /admin/auth instead."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.shared.customer_login import service
from app.shared.customer_login.schemas import CodeIn, PhoneIn, SessionOut, SignUpIn, VerifyOut

router = APIRouter(prefix="/auth", tags=["customer login"])


@router.post("/otp/send")
def send_code(body: PhoneIn, db: Session = Depends(get_db)) -> dict:
    """Sends a 6-digit code to the number (answers the same whether or not it has an account)."""
    service.send_code(db, body.phone)
    return {}


@router.post("/otp/verify", response_model=VerifyOut, response_model_exclude_none=True)
def verify_code(body: CodeIn, db: Session = Depends(get_db)) -> VerifyOut:
    return service.verify_code(db, body.phone, body.code)


@router.post("/register", response_model=SessionOut)
def sign_up(body: SignUpIn, db: Session = Depends(get_db)) -> SessionOut:
    return service.sign_up(db, body.phone, body.name, body.email)
