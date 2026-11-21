"""Security rules that hold across the whole API: who may call what, limits against guessing and flooding, and what
production mode turns off. Run on every test run, so a new route without protection is caught straight away."""

import datetime as dt

import pytest
from fastapi import HTTPException

from app.core.config import Settings, production_problems, settings
from app.main import app
from app.shared.customer_login import service as customer_login

PUBLIC = {  # the only addresses anyone may call without signing in
    ("GET", "/api/health"),
    ("POST", "/api/admin/auth/login"), ("POST", "/api/admin/auth/forgot-password"),
    ("POST", "/api/auth/otp/send"), ("POST", "/api/auth/otp/verify"), ("POST", "/api/auth/register"),
    # The customer app's public data (tests/test_public.py checks it shows nothing private).
    ("GET", "/api/services"), ("GET", "/api/plans"), ("GET", "/api/shop"), ("GET", "/api/slots"),
    ("GET", "/api/banners"), ("GET", "/api/gallery"), ("GET", "/api/pages/{key}"), ("GET", "/api/faqs"), ("GET", "/api/pet-options"),
}


def addresses():
    """Every address the API has (as /docs lists them), with path parameters filled in."""
    for path, operations in app.openapi()["paths"].items():
        for method in operations:
            yield method.upper(), path, path.replace("{", "x").replace("}", "")


def test_every_address_needs_the_right_sign_in(client, monkeypatch):
    codes = []
    monkeypatch.setattr(customer_login, "deliver", lambda phone, code: codes.append(code))
    client.post("/api/auth/otp/send", json={"phone": "9000000001"})
    client.post("/api/auth/otp/verify", json={"phone": "9000000001", "code": codes[-1]})
    customer_token = client.post("/api/auth/register", json={"phone": "9000000001", "name": "Test"}).json()["token"]

    checked = 0
    for method, path, url in addresses():
        if (method, path) in PUBLIC:
            continue
        if path.startswith("/api/admin/"):
            for headers in ({}, {"Authorization": f"Bearer {customer_token}"}, {"Authorization": "Bearer not-a-token"}):
                assert client.request(method, url, json={}, headers=headers).status_code == 401, f"{method} {path} answered {headers}"
        else:  # the customer app's private addresses: a customer's own pets, bookings, plan (Module 11)
            for headers in ({}, {"Authorization": "Bearer not-a-token"}):
                assert client.request(method, url, json={}, headers=headers).status_code == 401, f"{method} {path} answered {headers}"
        checked += 1
    assert checked > 100  # every protected address was tried


def test_staff_sign_in_slows_down_guessing(client, db):
    from app.shared.staff.service import create_staff

    create_staff(db, "Meera K.", "meera@poshpaws.in", "admin", "pawsword")

    def sign_in(password, email="meera@poshpaws.in"):
        return client.post("/api/admin/auth/login", json={"email": email, "password": password})

    assert sign_in("wrong").json()["detail"] == sign_in("wrong", "nobody@poshpaws.in").json()["detail"]  # unknown email: the same answer
    for _ in range(4):
        assert sign_in("wrong").status_code == 401
    blocked = sign_in("pawsword")  # even the right password waits after 5 wrong tries in 15 minutes
    assert blocked.status_code == 429 and blocked.json()["detail"] == "Too many sign-in attempts. Wait 15 minutes, or reset your password."

    from app.core.rate_limit import Attempt

    for row in db.query(Attempt):
        row.at -= dt.timedelta(minutes=16)  # 15 minutes later
    db.commit()
    assert sign_in("pawsword").status_code == 200


def test_login_codes_cant_be_sprayed_or_guessed_for_days(client, db, monkeypatch):
    codes = []
    monkeypatch.setattr(customer_login, "deliver", lambda phone, code: codes.append(code))
    for i in range(20):
        assert client.post("/api/auth/otp/send", json={"phone": f"90000000{i:02}"}).status_code == 200
    sprayed = client.post("/api/auth/otp/send", json={"phone": "9000000099"})  # the 21st number from the same place in an hour
    assert sprayed.status_code == 429 and sprayed.json()["detail"] == "Too many codes asked for from here. Try again in an hour."

    from app.core.rate_limit import Attempt
    from app.shared.customer_login.models import LoginCode

    db.query(Attempt).delete()
    db.commit()
    phone, wrong = "9000000000", "000000" if codes[0] != "000000" else "111111"
    for _ in range(2):  # two codes, 5 wrong tries each
        for _ in range(5):
            client.post("/api/auth/otp/verify", json={"phone": phone, "code": wrong})
        for row in db.query(LoginCode):
            row.created_at -= dt.timedelta(minutes=1)
        db.commit()
        client.post("/api/auth/otp/send", json={"phone": phone})
    capped = client.post("/api/auth/otp/verify", json={"phone": phone, "code": codes[-1]})
    assert capped.json()["detail"] == "Too many wrong codes today. Try again tomorrow, or call the shop."


def test_production_mode_turns_off_what_is_only_for_the_mac(monkeypatch, db):
    assert set(production_problems(Settings())) == {  # the defaults are for a Mac only
        "SECRET_KEY must be a long random value (32+ characters), not the example one.",
        "PUBLIC_URL must be the API's https:// address.",
        "CORS_ORIGINS must list only the apps' https:// addresses.",
    }
    ready = Settings(secret_key="x" * 48, public_url="https://api.poshpaws.in", cors_origins=["https://poshpaws.in", "https://admin.poshpaws.in"])
    assert production_problems(ready) == []

    monkeypatch.setattr(settings, "app_env", "production")
    with pytest.raises(HTTPException) as no_codes_in_logs:
        customer_login.deliver("9822041763", "123456")
    assert no_codes_in_logs.value.status_code == 503
    from app.grooming.bookings.service import pay_link

    with pytest.raises(HTTPException) as no_demo_payments:
        pay_link(db, object())
    assert no_demo_payments.value.detail == "Online payments come from the payment gateway."


def test_replies_carry_safety_headers_and_photo_addresses_are_checked(client, signed_in):
    headers = client.get("/api/health").headers
    assert (headers["x-content-type-options"], headers["x-frame-options"]) == ("nosniff", "DENY")
    service = {"name": "Bath", "petType": "dog", "category": "Bath", "durationMinutes": 45, "pricePaise": 100_000, "imageUrl": "javascript:alert(1)"}
    refused = client.post("/api/admin/services", json=service, headers=signed_in("admin"))
    assert refused.status_code == 422 and refused.json()["detail"] == "That photo address doesn't look right. Upload the photo again."
