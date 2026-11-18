"""Offers (Catalog › Offers): status from dates, limits and flags; unique codes."""

from datetime import timedelta

from app.core.dates import today
from app.grooming.offers.models import Offer

OFFERS = "/api/admin/offers"


def offer(**change) -> dict:
    t = today()
    return {"title": "Diwali week", "discountType": "percent", "value": 20, "code": "diwali20", "appliesTo": "all_services",
            "startsOn": str(t - timedelta(days=2)), "endsOn": str(t + timedelta(days=5)), "totalUses": 100, "perCustomer": 1} | change


def test_offer_status_comes_from_dates_limits_and_flags(client, signed_in, db):
    admin, staff = signed_in("admin"), signed_in("staff")
    t = today()
    live = client.post(OFFERS, json=offer(), headers=admin).json()
    assert live["code"] == "DIWALI20" and live["status"] == "live" and live["used"] == 0
    client.post(OFFERS, json=offer(title="Soon", code=None, startsOn=str(t + timedelta(days=1))), headers=admin)
    client.post(OFFERS, json=offer(title="Old", code="OLD10", startsOn=str(t - timedelta(days=30)), endsOn=str(t - timedelta(days=1))), headers=admin)
    draft = client.post(OFFERS, json=offer(title="Idea", code="IDEA", draft=True), headers=admin).json()
    full = client.post(OFFERS, json=offer(title="Gone", code="GONE", totalUses=5), headers=admin).json()
    db.get(Offer, full["id"]).used = 5  # used up (bookings count uses from Module 5)
    db.commit()

    listed = client.get(OFFERS, headers=staff).json()
    assert [(o["title"], o["status"]) for o in listed] == [
        ("Diwali week", "live"), ("Soon", "scheduled"), ("Idea", "draft"), ("Gone", "used_up"), ("Old", "expired")]

    assert client.post(f"{OFFERS}/{live['id']}/pause", headers=staff).status_code == 403
    assert client.post(f"{OFFERS}/{live['id']}/pause", headers=admin).json()["status"] == "paused"
    assert client.post(f"{OFFERS}/{live['id']}/resume", headers=admin).json()["status"] == "live"
    paused_draft = client.post(f"{OFFERS}/{draft['id']}/pause", headers=admin)
    assert paused_draft.status_code == 409 and paused_draft.json()["detail"] == "Drafts aren't running yet. Schedule the offer instead."

    running = client.put(f"{OFFERS}/{draft['id']}", json=offer(title="Idea", code="IDEA"), headers=admin).json()
    assert running["status"] == "live"  # saved without draft, and it has started


def test_offers_are_checked(client, signed_in):
    admin = signed_in("admin")
    client.post(OFFERS, json=offer(), headers=admin)
    bath = {"name": "Cat Bath", "petType": "cat", "category": "Bath", "durationMinutes": 40, "pricePaise": 90_000}
    cat_bath = client.post("/api/admin/services", json=bath, headers=admin).json()["id"]
    some = client.post(OFFERS, json=offer(code="CATS", appliesTo="some_services", serviceIds=[cat_bath, "unknown"]), headers=admin).json()
    assert some["serviceIds"] == [cat_bath]  # only real services
    everything = client.post(OFFERS, json=offer(code="ALL", serviceIds=[cat_bath], totalUses=0, perCustomer=None), headers=admin).json()
    assert everything["serviceIds"] == [] and everything["totalUses"] == 1 and everything["perCustomer"] is None

    def detail(**change):
        return client.post(OFFERS, json=offer(**change), headers=admin).json()["detail"]

    assert detail() == "The code DIWALI20 is already used by another offer."
    assert detail(code="NO SPACES") == "Codes use 3–20 letters and numbers, no spaces."
    assert detail(code=None, value=120) == "A percentage can't be more than 100."
    assert detail(code=None, value=0) == "Enter a discount value."
    assert detail(code=None, title=" ") == "Enter a title."
    assert detail(code=None, startsOn="") == "Pick a start date."
    assert detail(code=None, endsOn=str(today() - timedelta(days=10))) == "The end date is before the start date."
    assert detail(code=None, appliesTo="some_services", serviceIds=[]) == "Pick at least one service."
    assert detail(code=None, appliesTo="some_services", serviceIds=["unknown"]) == "Pick at least one service."
    assert detail(code=None, discountType="half") == "Pick % or ₹ flat."
