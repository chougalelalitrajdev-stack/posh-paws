"""A small shop for the slot and booking tests (default settings: open 09:00–19:00 every day, break 14:00–14:30,
a start every 30 minutes, 15 minutes of cleaning after each visit, 30 minutes' notice, bookable 30 days ahead)."""

from datetime import timedelta
from types import SimpleNamespace

import pytest

from app.core.dates import today


@pytest.fixture
def shop(client, signed_in):
    """Station 1 (an all-rounder), a 45-minute dog bath (₹1,200), a 40-minute cat bath (₹900), and Ananya with Coco (dog) and Luna (cat)."""
    admin, staff = signed_in("admin"), signed_in("staff")
    client.get("/api/admin/stations", headers=admin)  # a fresh shop gets Station 1 the first time its stations are read

    def post(url, body):
        reply = client.post(f"/api/admin{url}", json=body, headers=admin)
        assert reply.status_code == 200, reply.text
        return reply.json()

    bath = post("/services", {"name": "Signature Bath", "petType": "dog", "category": "Bath", "durationMinutes": 45, "pricePaise": 120_000})
    cat_bath = post("/services", {"name": "Gentle Cat Bath", "petType": "cat", "category": "Bath", "durationMinutes": 40, "pricePaise": 90_000})
    ananya = post("/customers", {"name": "Ananya Desai", "phone": "9822041763"})
    coco = post(f"/customers/{ananya['id']}/pets", {"name": "Coco", "type": "dog"})
    luna = post(f"/customers/{ananya['id']}/pets", {"name": "Luna", "type": "cat"})
    return SimpleNamespace(admin=admin, staff=staff, bath=bath["id"], cat_bath=cat_bath["id"], customer=ananya["id"], coco=coco["id"],
                           luna=luna["id"], tomorrow=today() + timedelta(days=1))


@pytest.fixture
def book(client, shop):
    """book("10:00") → a confirmed booking for Coco's bath tomorrow (or another pet, service or day)."""

    def make(time, pet=None, service=None, date=None, offer_code=None, confirm=True):
        details = {"customerId": shop.customer, "petId": pet or shop.coco, "serviceId": service or shop.bath,
                   "date": str(date or shop.tomorrow) if time else None, "time": time, "offerCode": offer_code}
        draft = client.post("/api/admin/bookings", json=details, headers=shop.staff)
        assert draft.status_code == 200, draft.text
        if not confirm:
            return draft.json()
        confirmed = client.post(f"/api/admin/bookings/{draft.json()['id']}/confirm", headers=shop.staff)
        assert confirmed.status_code == 200, confirmed.text
        return confirmed.json()

    return make
