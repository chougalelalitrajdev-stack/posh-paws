"""The customer app's own data: pets, booking with the advance, cancelling, joining a plan. A customer only ever sees and
changes their own: anyone else's pet or booking is "not found"."""

from datetime import timedelta

import pytest

from app.core.config import settings
from app.core.dates import today
from app.grooming.bookings.models import Booking
from app.shared.customer_login import service as customer_login


@pytest.fixture
def app_login(client, monkeypatch):
    """app_login("9822041763") → headers for that customer, logged in with a code like in the app."""
    codes = []
    monkeypatch.setattr(customer_login, "deliver", lambda phone, code: codes.append(code))

    def log_in(phone, name="New customer"):
        client.post("/api/auth/otp/send", json={"phone": phone})
        reply = client.post("/api/auth/otp/verify", json={"phone": phone, "code": codes[-1]}).json()
        if reply["status"] == "new-user":
            reply = client.post("/api/auth/register", json={"phone": phone, "name": name}).json()
        return {"Authorization": f"Bearer {reply['token']}"}

    return log_in


@pytest.fixture
def ananya(app_login, shop):
    return app_login("9822041763")  # the customer in the shop fixture, with Coco (dog) and Luna (cat)


@pytest.fixture
def rohan(app_login, shop):
    return app_login("9765430981", "Rohan Mehta")


def book_body(shop, pet=None, day=1, time="10:00", **extra):
    return {"serviceId": shop.bath, "petId": pet or shop.coco, "date": str(today() + timedelta(days=day)), "time": time, **extra}


def test_my_pets_and_how_they_read_in_the_admin(client, shop, ananya, rohan):
    assert [p["name"] for p in client.get("/api/pets", headers=ananya).json()] == ["Coco", "Luna"]
    assert client.get("/api/pets", headers=rohan).json() == []  # Rohan sees only his own (none yet)

    pet = {"name": "Biscuit", "type": "dog", "breed": "Indie", "size": "small", "coat": "long", "temperament": ["calm", "shy-with-strangers"],
           "vaccination": "due-soon", "notes": "Towel-dry first."}
    made = client.post("/api/pets", json=pet, headers=ananya).json()
    assert made | {"id": ""} == {**pet, "id": "", "birthDate": None, "gender": None}
    staff_view = client.get(f"/api/admin/pets/{made['id']}", headers=shop.staff).json()["pet"]
    assert (staff_view["coat"], staff_view["temperament"], staff_view["vaccination"]) == ("Small · long", "Calm, Shy with strangers", "due_soon")

    edited = client.put(f"/api/pets/{made['id']}", json={**pet, "coat": "double", "temperament": []}, headers=ananya).json()
    assert (edited["size"], edited["coat"], edited["temperament"]) == ("small", "double", [])
    assert client.put(f"/api/pets/{made['id']}", json=pet, headers=rohan).status_code == 404  # not his pet
    assert client.post("/api/pets", json={**pet, "name": " "}, headers=ananya).json()["detail"] == "Enter your pet's name."


def test_booking_in_the_app_pays_the_advance_and_confirms(client, shop, ananya, rohan):
    bill = client.post("/api/bookings/quote", json={"serviceId": shop.bath}, headers=ananya).json()
    assert (bill["totalPaise"], bill["advancePaise"]) == (120_000, 10_000)

    booked = client.post("/api/bookings", json=book_body(shop, notes="Coco is nervous."), headers=ananya).json()
    assert (booked["status"], booked["paymentStatus"], booked["serviceIcon"], booked["petName"], booked["notes"]) == \
        ("confirmed", "part_paid", "🛁", "Coco", "Coco is nervous.")
    assert (booked["bill"]["paidPaise"], booked["bill"]["balancePaise"]) == (10_000, 110_000)
    assert set(booked) >= {"payments", "createdAt"} and "stationId" not in booked and "activity" not in booked  # no staff-only details

    staff_view = client.get(f"/api/admin/bookings/{booked['id']}", headers=shop.staff).json()
    assert staff_view["source"] == "app" and [a["title"] for a in staff_view["activity"]][-3:] == \
        ["Advance paid in the app", "Note from the customer", "Booked in the app"]
    assert [b["id"] for b in client.get("/api/bookings", headers=ananya).json()] == [booked["id"]]
    assert client.get("/api/bookings", headers=rohan).json() == []

    def detail(body, who=ananya):
        return client.post("/api/bookings", json=body, headers=who).json()["detail"]

    assert detail(book_body(shop)) == "Sorry, that time was just booked by someone else. Please pick another slot."  # one station
    assert detail(book_body(shop, pet=shop.luna, time="12:00")) == "Signature Bath is for dogs."
    assert detail(book_body(shop, time="12:00"), who=rohan) == "Pet not found."  # Ananya's pet, Rohan's booking
    client.post(f"/api/admin/services/{shop.bath}/archive", headers=shop.admin)
    assert detail(book_body(shop, time="12:00")) == "Service not found."  # only what the app shows


def test_cancelling_in_the_app(client, shop, ananya, rohan, db):
    early = client.post("/api/bookings", json=book_body(shop, day=3), headers=ananya).json()
    assert client.post(f"/api/bookings/{early['id']}/cancel", headers=rohan).status_code == 404  # not his booking
    cancelled = client.post(f"/api/bookings/{early['id']}/cancel", headers=ananya).json()
    assert (cancelled["status"], cancelled["paymentStatus"]) == ("cancelled", "refunded")  # 24 h or more before: refunded

    late = client.post("/api/bookings", json=book_body(shop, day=1, time="15:00"), headers=ananya).json()
    client.put("/api/admin/settings/payments", json={"linkExpiryHours": 24, "slotHoldPaise": 10_000, "freeCancellationHours": 72}, headers=shop.admin)
    kept = client.post(f"/api/bookings/{late['id']}/cancel", headers=ananya).json()
    assert (kept["paymentStatus"], kept["bill"]["paidPaise"]) == ("paid", 10_000)  # less than 72 h before: the advance is kept

    past = client.post("/api/bookings", json=book_body(shop, day=2), headers=ananya).json()
    db.get(Booking, past["id"]).date = today() - timedelta(days=1)
    db.commit()
    assert client.post(f"/api/bookings/{past['id']}/cancel", headers=ananya).json()["detail"] == "This booking can't be cancelled any more."


def test_joining_a_plan_and_using_its_sessions(client, shop, ananya):
    plan = {"name": "Posh", "pricePaise": 99_900, "billing": "month", "sessionsPerPeriod": 5, "discountPercent": 10,
            "eligibleServiceIds": [shop.bath], "subscribable": True}
    posh = client.post("/api/admin/plans", json=plan, headers=shop.admin).json()
    hidden = client.post("/api/admin/plans", json={**plan, "name": "Staff only", "subscribable": False}, headers=shop.admin).json()
    assert client.get("/api/subscriptions/current", headers=ananya).json() is None
    assert client.post("/api/subscriptions", json={"planId": hidden["id"]}, headers=ananya).status_code == 404

    joined = client.post("/api/subscriptions", json={"planId": posh["id"]}, headers=ananya).json()
    assert (joined["planName"], joined["status"], joined["sessionsLeft"], joined["discountPercent"]) == ("Posh", "active", 5, 10)
    assert client.post("/api/subscriptions", json={"planId": posh["id"]}, headers=ananya).json()["detail"] == \
        "You're on the Posh plan. To change it, call us and we'll switch it for you."

    session = client.post("/api/bookings", json=book_body(shop), headers=ananya).json()
    assert (session["bill"]["totalPaise"], session["bill"]["advancePaise"], session["paymentStatus"]) == (0, 0, "paid")  # ₹0: no advance
    assert client.get("/api/subscriptions/current", headers=ananya).json()["sessionsLeft"] == 4


def test_limits_and_production(client, shop, ananya, monkeypatch):
    for i in range(5):
        assert client.post("/api/bookings", json=book_body(shop, day=1, time=f"{9 + 2 * i:02}:00"), headers=ananya).status_code == 200
    too_many = client.post("/api/bookings", json=book_body(shop, day=2), headers=ananya)
    assert too_many.status_code == 409 and too_many.json()["detail"] == "You already have 5 upcoming bookings. Call us to book more."

    monkeypatch.setattr(settings, "app_env", "production")  # no payment gateway yet: no stand-in payments online
    assert client.post("/api/bookings", json=book_body(shop, day=3), headers=ananya).json()["detail"] == "Online booking opens soon. Please call us to book."
    assert client.get("/api/bookings", headers=shop.staff).status_code == 401  # a staff token isn't a customer's
