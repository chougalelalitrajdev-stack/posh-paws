"""Customer login with a one-time code (OTP): send a code, check it, then log in or sign up. The same customer accounts as the
admin's Customers (a customer staff added by phone logs straight in).

Limits against abuse: one code every 30 seconds and 5 an hour per number, 20 an hour from one place (so nobody can send
codes to thousands of numbers), 5 wrong tries per code and 10 a day per number, codes last 10 minutes.
"""

import datetime as dt
import secrets

from fastapi import Depends, Header, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import rate_limit
from app.core.config import settings
from app.core.database import get_db
from app.core.security import create_token, hash_password, read_token, verify_password
from app.shared.customer_login.models import LoginCode
from app.shared.customer_login.schemas import CustomerUser, SessionOut, VerifyOut
from app.shared.customers.models import Customer

CODE_MINUTES = 10
RESEND_SECONDS = 30
CODES_PER_HOUR = 5
MAX_TRIES = 5
SIGNUP_MINUTES = 15  # after confirming a new number, how long they have to give their name
AUDIENCE = "customer"


def _utc_now() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


def deliver(phone: str, code: str) -> None:
    """Sends the code. Until an SMS or WhatsApp provider is connected (before launch), it's printed in the server's terminal,
    on your Mac only: online, codes must never end up in the server's logs."""
    if settings.production:
        raise HTTPException(status_code=503, detail="We can't send login codes right now. Please call the shop to book.")
    print(f"\n  Login code for {phone}: {code}   (shown here because no SMS provider is connected yet)\n", flush=True)


def send_code(db: Session, phone: str, ip: str) -> None:
    now = _utc_now()
    rate_limit.check(db, f"otp-send-ip:{ip}", 20, dt.timedelta(hours=1), "Too many codes asked for from here. Try again in an hour.")
    recent = list(db.scalars(select(LoginCode).where(LoginCode.phone == phone, LoginCode.created_at > now - dt.timedelta(hours=1))
                             .order_by(LoginCode.created_at.desc())))
    if recent and now - recent[0].created_at < dt.timedelta(seconds=RESEND_SECONDS):
        raise HTTPException(status_code=429, detail=f"Please wait {RESEND_SECONDS} seconds before asking for another code.")
    if len(recent) >= CODES_PER_HOUR:
        raise HTTPException(status_code=429, detail="Too many codes for this number. Try again in an hour.")
    code = f"{secrets.randbelow(1_000_000):06d}"  # secrets, not random: codes nobody can predict
    db.add(LoginCode(phone=phone, code_hash=hash_password(code), expires_at=now + dt.timedelta(minutes=CODE_MINUTES)))
    rate_limit.count(db, f"otp-send-ip:{ip}")
    db.commit()
    deliver(phone, code)


def session(c: Customer) -> SessionOut:
    token = create_token({"sub": c.id, "name": c.name, "phone": c.phone}, audience=AUDIENCE, days=settings.customer_token_days)
    return SessionOut(user=CustomerUser.model_validate(c), token=token)


def verify_code(db: Session, phone: str, code: str) -> VerifyOut:
    """Only the latest code counts. The right code logs a known customer in; a new number goes on to sign up."""
    latest = db.scalar(select(LoginCode).where(LoginCode.phone == phone).order_by(LoginCode.created_at.desc()).limit(1))
    if not latest or latest.verified_at or latest.expires_at < _utc_now():
        raise HTTPException(status_code=400, detail="That code has expired. Ask for a new one.")
    if latest.attempts >= MAX_TRIES:
        raise HTTPException(status_code=400, detail="Too many wrong tries. Ask for a new code.")
    # New codes give 5 more tries each, so wrong codes are also capped per number per day.
    rate_limit.check(db, f"otp-wrong:{phone}", 10, dt.timedelta(days=1), "Too many wrong codes today. Try again tomorrow, or call the shop.")
    if not verify_password(code, latest.code_hash):
        latest.attempts += 1
        rate_limit.count(db, f"otp-wrong:{phone}")
        db.commit()
        raise HTTPException(status_code=400, detail="That code is incorrect. Please try again.")
    latest.verified_at = _utc_now()
    db.commit()
    customer = db.scalar(select(Customer).where(Customer.phone == phone))
    if not customer:
        return VerifyOut(status="new-user")
    return VerifyOut(status="authenticated", **session(customer).model_dump())


def sign_up(db: Session, phone: str, name: str, email: str | None) -> SessionOut:
    """A new customer, allowed only for a number confirmed with a code in the last few minutes."""
    confirmed = db.scalar(select(LoginCode.id).where(
        LoginCode.phone == phone, LoginCode.verified_at > _utc_now() - dt.timedelta(minutes=SIGNUP_MINUTES)).limit(1))
    if not confirmed:
        raise HTTPException(status_code=400, detail="Please confirm your number with a code first.")
    if db.scalar(select(Customer.id).where(Customer.phone == phone)):
        raise HTTPException(status_code=409, detail="This number already has an account. Log in instead.")
    customer = Customer(name=name, phone=phone, email=email)
    db.add(customer)
    db.commit()
    return session(customer)


def current_customer(authorization: str | None = Header(default=None), db: Session = Depends(get_db)) -> Customer:
    """Use as Depends(current_customer) on the customer app's routes: the logged-in customer, or 401."""
    claims = read_token((authorization or "").removeprefix("Bearer "), audience=AUDIENCE)
    customer = db.get(Customer, claims["sub"]) if claims else None
    if not customer:
        raise HTTPException(status_code=401, detail="Please log in.")
    return customer
