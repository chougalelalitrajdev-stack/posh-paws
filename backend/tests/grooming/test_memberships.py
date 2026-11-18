"""Memberships (root CLAUDE.md › Booking & payment rules): plan sessions and member discounts on bills, plan changes, renewals,
and the customer numbers that come from bookings, payments and memberships."""

from datetime import timedelta

import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.core.dates import add_months, today
from app.grooming.bookings.models import Booking
from app.grooming.plans.models import Plan
from app.grooming.subscriptions.models import SUBSCRIPTION_NUMBER, Subscription

BOOKINGS = "/api/admin/bookings"
SUBS = "/api/admin/subscriptions"


@pytest.fixture
def plans(client, shop):
    """Basic (₹499, 2 sessions), Posh (₹999, 5 sessions, 10% off) and Royal (₹1,999, unlimited, 20% off); sessions cover the dog bath."""
    def plan(name, price, sessions, percent):
        body = {"name": name, "pricePaise": price, "billing": "month", "sessionsPerPeriod": sessions, "discountPercent": percent,
                "eligibleServiceIds": [shop.bath], "subscribable": True}
        return client.post("/api/admin/plans", json=body, headers=shop.admin).json()["id"]

    return {"basic": plan("Basic", 49_900, 2, 0), "posh": plan("Posh", 99_900, 5, 10), "royal": plan("Royal", 199_900, None, 20)}


@pytest.fixture
def join(db, shop, plans):
    """join("posh", used=3) → Ananya's membership (made directly: customers join in the app, Module 11)."""
    def make(plan_key, used=0, status="active", renews_in=10, customer=None):
        plan = db.get(Plan, plans[plan_key])
        number = db.scalar(select(SUBSCRIPTION_NUMBER.next_value()))
        s = Subscription(id=f"SUB-{number}", customer_id=customer or shop.customer, plan_id=plan.id, plan_name=plan.name, price_paise=plan.price_paise,
                         sessions_total=plan.sessions_per_period, sessions_used=used, status=status,
                         started_on=today() - timedelta(days=6 if status == "payment_pending" else 200),  # signed up, not paid yet
                         renews_on=today() + timedelta(days=renews_in) if status == "active" else None)
        db.add(s)
        db.commit()
        return s.id

    return make


def quote(client, shop, service=None, code=None):
    return client.post(f"{BOOKINGS}/quote", json={"customerId": shop.customer, "serviceId": service or shop.bath, "offerCode": code},
                       headers=shop.staff).json()


def test_plan_sessions_and_member_discounts_on_bills(client, shop, book, join, db):
    sub = join("posh", used=4)
    session = quote(client, shop)
    assert session["discount"]["label"] == "Posh plan session" and session["totalPaise"] == 0  # a session covers the bath
    member = quote(client, shop, service=shop.cat_bath)  # the plan doesn't cover the cat bath: 10% off instead
    assert (member["discount"]["kind"], member["discount"]["label"], member["totalPaise"]) == ("membership", "Posh member 10% off", 81_000)

    b = book("10:00")
    assert (b["bill"]["totalPaise"], b["paymentStatus"]) == (0, "paid") and b["activity"][0]["detail"] == "Covered by the plan session; nothing to pay."
    assert db.get(Subscription, sub).sessions_used == 5  # used when confirmed
    assert quote(client, shop)["discount"]["label"] == "Posh member 10% off"  # no sessions left: the member discount
    draft = book("12:00", confirm=False)
    assert client.post(f"{BOOKINGS}/{draft['id']}/payment-link", json={}, headers=shop.staff).status_code == 200  # 10% off, so there's money to pay

    client.post(f"{BOOKINGS}/{b['id']}/cancel", json={}, headers=shop.staff)
    db.expire_all()
    assert db.get(Subscription, sub).sessions_used == 4  # given back on cancel
    offer = {"title": "Big week", "discountType": "percent", "value": 20, "code": "BIG20", "appliesTo": "all_services", "startsOn": str(today())}
    client.post("/api/admin/offers", json=offer, headers=shop.admin)
    assert quote(client, shop, service=shop.cat_bath, code="BIG20")["discount"]["label"] == "BIG20 · Big week"  # beats the member's 10%


def test_plan_changes(client, shop, join, plans, signed_in):
    sub = join("posh", used=3)
    options = {o["name"]: o for o in client.get(f"{SUBS}/{sub}/plan-options", headers=shop.staff).json()}
    assert (options["Posh"]["change"], options["Posh"]["sessionsLeft"]) == ("current", 2)
    assert (options["Royal"]["change"], options["Royal"]["payNowPaise"], options["Royal"]["sessionsLeft"]) == ("upgrade", 100_000, None)
    assert (options["Basic"]["change"], options["Basic"]["startsOn"]) == ("downgrade", str(today() + timedelta(days=10)))

    url = f"{SUBS}/{sub}/change-plan"
    assert client.post(url, json={"planId": plans["royal"]}, headers=shop.staff).status_code == 403  # Admins change plans
    assert client.post(url, json={"planId": plans["royal"]}, headers=shop.admin).json()["detail"] == "Choose how they paid the ₹1,000 difference."
    up = client.post(url, json={"planId": plans["royal"], "method": "cash"}, headers=shop.admin).json()
    assert (up["planName"], up["pricePaise"], up["sessionsTotal"], up["sessionsUsed"], up["renewsOn"]) == ("Royal", 199_900, None, 3, str(today() + timedelta(days=10)))
    assert up["changes"][0] | {"at": ""} == {"at": "", "kind": "upgrade", "fromPlan": "Posh", "toPlan": "Royal", "paidPaise": 100_000, "method": "cash", "by": "Meera K."}
    rows = client.get(f"/api/admin/customers/{shop.customer}/payments", headers=shop.staff).json()
    assert [(r["item"], r["detail"], r["amountPaise"]) for r in rows] == [("Upgrade from Posh", "Difference · Cash", 100_000)]

    down = client.post(url, json={"planId": plans["basic"]}, headers=shop.admin).json()
    assert down["planName"] == "Royal" and down["nextPlan"]["planName"] == "Basic"  # starts at renewal
    kept = client.post(url, json={"planId": plans["royal"]}, headers=shop.admin).json()
    assert kept["nextPlan"] is None and kept["changes"][0]["kind"] == "keep"
    assert client.post(url, json={"planId": plans["royal"]}, headers=shop.admin).json()["detail"] == "They're already on the Royal plan."


def test_renewal_and_first_payment_links(client, shop, join, plans, db):
    sub = join("posh", renews_in=3)
    client.post(f"{SUBS}/{sub}/change-plan", json={"planId": plans["basic"]}, headers=shop.admin)  # downgrade at renewal
    sent = client.post(f"{SUBS}/{sub}/payment-link", headers=shop.staff).json()["paymentLink"]
    assert (sent["amountPaise"], sent["planName"]) == (49_900, "Basic")  # they renew onto Basic
    renewed = client.post(f"{SUBS}/{sub}/demo-pay", headers=shop.staff).json()
    assert (renewed["planName"], renewed["pricePaise"], renewed["sessionsTotal"], renewed["sessionsUsed"], renewed["nextPlan"]) == ("Basic", 49_900, 2, 0, None)
    assert renewed["renewsOn"] == str(add_months(today() + timedelta(days=3), 1)) and renewed["paymentLink"] is None

    other = client.post("/api/admin/customers", json={"name": "Rohan Mehta", "phone": "9765430981"}, headers=shop.staff).json()
    pending = join("royal", status="payment_pending", customer=other["id"])
    client.post(f"{SUBS}/{pending}/payment-link", headers=shop.staff)
    waiting = client.get("/api/admin/payments", params={"tab": "waiting"}, headers=shop.staff).json()["items"]
    assert [(r["id"], r["item"], r["amountPaise"]) for r in waiting] == [(f"{pending}-LINK", "First month", 199_900)]
    started = client.post(f"{SUBS}/{pending}/demo-pay", headers=shop.staff).json()
    assert (started["status"], started["renewsOn"]) == ("active", str(add_months(today(), 1)))
    paid = {r["id"]: r for r in client.get("/api/admin/payments", params={"tab": "paid"}, headers=shop.staff).json()["items"]}
    assert paid[f"PAY-{pending}-1"]["item"] == "First month" and paid[f"PAY-{sub}-1"]["item"] == "Plan renewal"

    summary = client.get(f"{SUBS}/summary", headers=shop.staff).json()
    assert summary["active"] == 2 and summary["counts"]["active"] == 2 and summary["monthlyPaise"] == 49_900 + 199_900
    listed = client.get(SUBS, params={"tab": "active"}, headers=shop.staff).json()
    assert listed["total"] == 2 and {s["customer"]["name"] for s in listed["items"]} == {"Ananya Desai", "Rohan Mehta"}

    ended = join("basic", status="expired", customer=client.post("/api/admin/customers", json={"name": "Neha", "phone": "9850766124"}, headers=shop.staff).json()["id"])
    assert client.post(f"{SUBS}/{ended}/payment-link", headers=shop.staff).json()["detail"] == "This plan has ended. Start a new subscription instead."

    # One running membership per customer: the database refuses a second one.
    with pytest.raises(IntegrityError, match="one_membership_per_customer"):
        join("royal")
    db.rollback()


def test_customer_numbers_come_from_bookings_payments_and_memberships(client, shop, book, join, db):
    join("posh", used=5)  # no sessions left: bills get 10% off
    visit = book("10:00")
    db.get(Booking, visit["id"]).date = today() - timedelta(days=1)
    db.commit()
    client.post(f"{BOOKINGS}/{visit['id']}/payments", json={"amountPaise": 108_000, "method": "cash", "complete": True}, headers=shop.staff)
    upcoming = book("11:00")

    rohan = client.post("/api/admin/customers", json={"name": "Rohan Mehta", "phone": "9765430981"}, headers=shop.staff).json()
    rex = client.post(f"/api/admin/customers/{rohan['id']}/pets", json={"name": "Rex", "type": "dog"}, headers=shop.staff).json()
    details = {"customerId": rohan["id"], "petId": rex["id"], "serviceId": shop.bath, "date": str(shop.tomorrow), "time": "15:00"}
    old = client.post(BOOKINGS, json=details, headers=shop.staff).json()
    old_booking = db.get(Booking, old["id"])
    old_booking.date, old_booking.stage = today() - timedelta(days=100), "completed"  # last seen 100 days ago
    db.commit()

    rows = {r["name"]: r for r in client.get("/api/admin/customers", headers=shop.staff).json()["items"]}
    ananya = rows["Ananya Desai"]
    assert (ananya["planName"], ananya["bookingsCount"], ananya["spentPaise"], ananya["lastVisit"]) == ("Posh", 2, 108_000, str(today() - timedelta(days=1)))
    assert ananya["next"] == {"kind": "booking", "date": str(shop.tomorrow), "time": "11:00"} and not ananya["lapsed"]
    assert rows["Rohan Mehta"]["lapsed"] is True
    counts = client.get("/api/admin/customers/counts", headers=shop.staff).json()
    assert (counts["members"], counts["lapsed"], counts["no_plan"]) == (1, 1, 1)
    assert [c["name"] for c in client.get("/api/admin/customers", params={"plan": "Posh"}, headers=shop.staff).json()["items"]] == ["Ananya Desai"]
    assert [c["name"] for c in client.get("/api/admin/customers", params={"sort": "spent"}, headers=shop.staff).json()["items"]][0] == "Ananya Desai"

    profile = client.get(f"/api/admin/customers/{shop.customer}", headers=shop.staff).json()
    assert (profile["plan"]["name"], profile["plan"]["sessionsLeft"], profile["pastBookings"], profile["spentPaise"]) == ("Posh", 0, 1, 108_000)
    assert profile["lastVisit"] == {"date": str(today() - timedelta(days=1)), "serviceName": "Signature Bath", "petName": "Coco"}
    activity = [a["title"] for a in client.get(f"/api/admin/customers/{shop.customer}/activity", headers=shop.staff).json()]
    assert {"Marked completed", "Joined the Posh plan", "Became a customer"} <= set(activity)

    coco = client.get(f"/api/admin/pets/{shop.coco}", headers=shop.staff).json()
    assert coco["lastGroom"] == str(today() - timedelta(days=1)) and [v["bookingId"] for v in coco["visits"]] == [visit["id"]]

    found = client.get("/api/admin/search", params={"q": "coco"}, headers=shop.staff).json()
    assert [c["name"] for c in found["customers"]] == ["Ananya Desai"] and [p["ownerName"] for p in found["pets"]] == ["Ananya Desai"]
    assert [b["id"] for b in client.get("/api/admin/search", params={"q": upcoming["id"]}, headers=shop.staff).json()["bookings"]] == [upcoming["id"]]

    client.post("/api/admin/settings/closures", json={"date": str(shop.tomorrow), "name": "Repairs", "closesAt": "11:30"}, headers=shop.staff)
    closures = client.get("/api/admin/settings", headers=shop.staff).json()["booking"]["closures"]
    assert closures[0]["affectedBookings"] == 1  # the 11:00 bath runs past 11:30

    members = client.get("/api/admin/dashboard", headers=shop.staff).json()["memberships"]
    assert members["active"] == 1 and {"name": "Posh", "count": 1} in members["plans"]
