"""Customer login with a one-time code: sending, checking, signing up, the limits, and keeping customer and staff tokens apart."""

import datetime as dt

import pytest
from fastapi import HTTPException

from app.shared.customer_login import service
from app.shared.customer_login.models import LoginCode

AUTH = "/api/auth"
PHONE = "9822041763"


@pytest.fixture
def codes(monkeypatch):
    """The codes that would have gone out by SMS: codes[-1] is the latest."""
    sent: list[str] = []
    monkeypatch.setattr(service, "deliver", lambda phone, code: sent.append(code))
    return sent


def allow_resend(db):
    """Pretends the last code was sent a minute ago (tests can't wait 30 seconds)."""
    for row in db.query(LoginCode):
        row.created_at -= dt.timedelta(minutes=1)
    db.commit()


def test_a_new_customer_confirms_their_number_then_signs_up(client, codes, db):
    assert client.post(f"{AUTH}/otp/send", json={"phone": "+91 98220 41763"}).json() == {}
    assert len(codes) == 1 and len(codes[0]) == 6
    assert db.query(LoginCode).one().code_hash != codes[0]  # only a fingerprint is stored

    # Signing up before confirming the number is refused.
    assert client.post(f"{AUTH}/register", json={"phone": PHONE, "name": "Ananya"}).json()["detail"] == "Please confirm your number with a code first."

    wrong = "000000" if codes[0] != "000000" else "111111"
    assert client.post(f"{AUTH}/otp/verify", json={"phone": PHONE, "code": wrong}).json()["detail"] == "That code is incorrect. Please try again."
    assert client.post(f"{AUTH}/otp/verify", json={"phone": PHONE, "code": codes[0]}).json() == {"status": "new-user"}
    assert client.post(f"{AUTH}/otp/verify", json={"phone": PHONE, "code": codes[0]}).json()["detail"] == "That code has expired. Ask for a new one."  # used once

    def detail(body):
        return client.post(f"{AUTH}/register", json={"phone": PHONE, **body}).json()["detail"]

    assert detail({"name": " "}) == "Enter your name."
    assert detail({"name": "Ananya", "email": "ananya"}) == "That email doesn't look right."
    joined = client.post(f"{AUTH}/register", json={"phone": PHONE, "name": " Ananya Desai ", "email": "ananya@example.com"}).json()
    assert joined["user"] | {"id": ""} == {"id": "", "name": "Ananya Desai", "phone": PHONE, "email": "ananya@example.com"} and joined["token"]
    assert detail({"name": "Again"}) == "This number already has an account. Log in instead."

    # The new customer shows in the admin's Customers, like one staff added.
    staff_headers = staff_token(client, db)
    assert client.get("/api/admin/customers/lookup", params={"phone": PHONE}, headers=staff_headers).json()["name"] == "Ananya Desai"

    # Next time, the right code logs them straight in.
    allow_resend(db)
    client.post(f"{AUTH}/otp/send", json={"phone": PHONE})
    back = client.post(f"{AUTH}/otp/verify", json={"phone": PHONE, "code": codes[-1]}).json()
    assert back["status"] == "authenticated" and back["user"]["id"] == joined["user"]["id"]


def test_limits_on_codes_and_tries(client, codes, db):
    send = lambda: client.post(f"{AUTH}/otp/send", json={"phone": PHONE})  # noqa: E731
    assert send().status_code == 200
    too_soon = send()
    assert too_soon.status_code == 429 and too_soon.json()["detail"] == "Please wait 30 seconds before asking for another code."
    for _ in range(4):
        allow_resend(db)
        assert send().status_code == 200
    allow_resend(db)
    assert send().json()["detail"] == "Too many codes for this number. Try again in an hour."  # 5 an hour

    wrong = "000000" if codes[-1] != "000000" else "111111"
    for _ in range(5):
        client.post(f"{AUTH}/otp/verify", json={"phone": PHONE, "code": wrong})
    # After 5 wrong tries even the right code stops working.
    assert client.post(f"{AUTH}/otp/verify", json={"phone": PHONE, "code": codes[-1]}).json()["detail"] == "Too many wrong tries. Ask for a new code."
    assert client.post(f"{AUTH}/otp/send", json={"phone": "98220"}).json()["detail"] == "Enter a 10-digit mobile number."
    assert client.post(f"{AUTH}/otp/verify", json={"phone": PHONE, "code": "12"}).json()["detail"] == "Enter the 6-digit code."

    for row in db.query(LoginCode):
        row.attempts, row.expires_at = 0, dt.datetime.now(dt.timezone.utc) - dt.timedelta(minutes=1)  # 10 minutes have passed
    db.commit()
    assert client.post(f"{AUTH}/otp/verify", json={"phone": PHONE, "code": codes[-1]}).json()["detail"] == "That code has expired. Ask for a new one."


def test_customer_and_staff_tokens_stay_apart(client, codes, db, signed_in):
    staff = signed_in("staff")
    client.post("/api/admin/customers", json={"name": "Priya Sharma", "phone": "9876543210"}, headers=staff)  # added by staff on a call
    client.post(f"{AUTH}/otp/send", json={"phone": "9876543210"})
    priya = client.post(f"{AUTH}/otp/verify", json={"phone": "9876543210", "code": codes[-1]}).json()
    assert priya["status"] == "authenticated" and priya["user"]["name"] == "Priya Sharma"  # the same account

    customer_headers = {"Authorization": f"Bearer {priya['token']}"}
    assert client.get("/api/admin/customers", headers=customer_headers).status_code == 401  # a customer can't open the admin
    assert service.current_customer(customer_headers["Authorization"], db).name == "Priya Sharma"
    with pytest.raises(HTTPException) as refused:
        service.current_customer(staff["Authorization"], db)  # and staff tokens don't work as a customer
    assert refused.value.status_code == 401 and refused.value.detail == "Please log in."


def staff_token(client, db) -> dict:
    from app.shared.staff.service import create_staff

    create_staff(db, "Amit J.", "amit@poshpaws.in", "staff", "pawsword")
    token = client.post("/api/admin/auth/login", json={"email": "amit@poshpaws.in", "password": "pawsword"}).json()["token"]
    return {"Authorization": f"Bearer {token}"}
