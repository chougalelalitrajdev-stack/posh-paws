"""Bookings (root CLAUDE.md › Booking & payment rules): drafts, the bill, confirming, no double booking, reschedule, cancel, closing a visit."""

from datetime import datetime, timedelta

import pytest
from sqlalchemy.dialects.postgresql import Range
from sqlalchemy.exc import IntegrityError

from app.core.dates import today
from app.grooming.bookings.models import Booking

BOOKINGS = "/api/admin/bookings"


def test_a_phone_booking_from_draft_to_confirmed(client, shop, book):
    draft = book(None, confirm=False)  # the slot can be picked later
    assert (draft["stage"], draft["date"], draft["time"], draft["stationId"]) == ("draft", None, None, None)
    assert draft["id"].startswith("PP-") and draft["bookedBy"] == "Amit J." and draft["source"] == "phone"
    assert draft["customer"]["name"] == "Ananya Desai" and draft["pet"]["name"] == "Coco" and draft["service"]["durationMinutes"] == 45
    assert draft["bill"] == {"servicePricePaise": 120_000, "discount": None, "totalPaise": 120_000, "advancePaise": 0, "paidPaise": 0, "balancePaise": 120_000}

    url = f"{BOOKINGS}/{draft['id']}"
    assert client.post(f"{url}/confirm", headers=shop.staff).json()["detail"] == "Pick a service and a slot first."
    details = {"customerId": shop.customer, "petId": shop.coco, "serviceId": shop.bath, "date": str(shop.tomorrow), "time": "10:00"}
    assert client.put(url, json=details, headers=shop.staff).json()["time"] == "10:00"

    confirmed = client.post(f"{url}/confirm", headers=shop.staff).json()
    assert confirmed["stage"] == "confirmed" and confirmed["stationId"] and confirmed["paymentStatus"] == "unpaid"
    assert [a["title"] for a in confirmed["activity"]] == ["Booking confirmed", "Booking details saved", "Booking details saved", "Booking started by staff"]
    assert confirmed["activity"][0]["detail"] == "₹1,200 to pay at the shop."
    assert client.put(url, json=details, headers=shop.staff).json()["detail"] == "Only drafts can be edited here. Use Reschedule instead."

    def detail(**change):
        return client.post(BOOKINGS, json={**details, **change}, headers=shop.staff).json()["detail"]

    assert detail(petId=shop.luna) == "Signature Bath is for dogs."
    assert detail(petId="nope") == "Pick one of the customer's pets."
    assert detail(time="10:30") == "That slot was just taken. Pick another time."
    assert detail(time="9am") == "Pick a time like 10:30."


def test_two_bookings_can_never_hold_the_same_station_at_once(client, shop, book, db):
    first, second = book("10:00", confirm=False), book("10:00", confirm=False)  # two drafts for the same time is fine
    first = client.post(f"{BOOKINGS}/{first['id']}/confirm", headers=shop.staff).json()
    assert first["stage"] == "confirmed"
    taken = client.post(f"{BOOKINGS}/{second['id']}/confirm", headers=shop.staff)
    assert taken.status_code == 409 and taken.json()["detail"] == "That slot was just taken. Pick another time."

    # Even if the checks above were skipped (two people pressing Confirm at the same instant), the database refuses it.
    start = datetime.combine(shop.tomorrow, datetime.min.time()).replace(hour=10, minute=30)
    clash = db.get(Booking, second["id"])
    clash.station_id, clash.stage, clash.held = first["stationId"], "confirmed", Range(start, start + timedelta(hours=1))
    with pytest.raises(IntegrityError, match="no_double_booking"):
        db.commit()
    db.rollback()


def test_reschedule_cancel_and_closing_a_visit(client, shop, book, db):
    b = book("10:00")
    url = f"{BOOKINGS}/{b['id']}"
    moved = client.post(f"{url}/reschedule", json={"date": str(shop.tomorrow), "time": "11:00"}, headers=shop.staff).json()
    assert moved["time"] == "11:00" and moved["activity"][0]["title"] == "Rescheduled"
    assert book("10:00")["time"] == "10:00"  # the old time is free again

    # Completed and no-show only once the appointment has started.
    early = client.post(f"{url}/complete", headers=shop.staff)
    assert early.status_code == 409 and early.json()["detail"] == "This appointment hasn't started yet. Mark it completed or a no-show once it has."
    db.get(Booking, b["id"]).date = today() - timedelta(days=1)
    db.commit()
    done = client.post(f"{url}/complete", headers=shop.staff).json()
    assert done["stage"] == "completed" and done["activity"][0]["detail"] == "₹1,200 still to pay."
    assert client.post(f"{url}/cancel", json={}, headers=shop.staff).json()["detail"] == "This booking can't be cancelled."

    other = book("12:00")
    cancelled = client.post(f"{BOOKINGS}/{other['id']}/cancel", json={"reason": "Pet unwell"}, headers=shop.staff).json()
    assert cancelled["stage"] == "cancelled" and cancelled["bill"]["balancePaise"] == 0 and cancelled["activity"][0]["detail"] == "Pet unwell"
    assert book("12:00")["time"] == "12:00"  # its slot is free again

    noted = client.post(f"{url}/notes", json={"text": " Loved the paw massage "}, headers=shop.staff).json()
    assert noted["activity"][0] | {"at": ""} == {"at": "", "kind": "note", "title": "Note", "detail": "Loved the paw massage", "by": "Amit J."}
    assert client.post(f"{url}/notes", json={"text": " "}, headers=shop.staff).json()["detail"] == "Write a note first."


def test_offers_on_the_bill(client, shop, book):
    offer = {"title": "Diwali week", "discountType": "percent", "value": 20, "code": "DIWALI20", "appliesTo": "all_services",
             "startsOn": str(today()), "totalUses": 100, "perCustomer": 1}
    client.post("/api/admin/offers", json=offer, headers=shop.admin)
    client.post("/api/admin/offers", json={**offer, "title": "Welcome", "code": None, "discountType": "flat", "value": 10_000, "perCustomer": None},
                headers=shop.admin)

    def quote(code=None, service=None):
        return client.post(f"{BOOKINGS}/quote", json={"customerId": shop.customer, "serviceId": service or shop.bath, "offerCode": code}, headers=shop.staff).json()

    automatic = quote()
    assert automatic["discount"]["label"] == "Welcome" and automatic["totalPaise"] == 110_000  # applied without a code
    with_code = quote("diwali20")
    assert with_code["discount"] == {"kind": "offer", "label": "DIWALI20 · Diwali week", "amountPaise": 24_000, "offerId": with_code["discount"]["offerId"]}
    assert quote("NOPE")["detail"] == "There's no offer with the code NOPE."

    b = book("10:00", offer_code="diwali20")
    assert b["offerCode"] == "DIWALI20" and b["bill"]["totalPaise"] == 96_000
    assert next(o for o in client.get("/api/admin/offers", headers=shop.staff).json() if o["code"] == "DIWALI20")["used"] == 1  # counted on confirm
    assert quote("DIWALI20")["detail"] == "This customer has already used DIWALI20."

    client.post(f"{BOOKINGS}/{b['id']}/cancel", json={}, headers=shop.staff)
    assert next(o for o in client.get("/api/admin/offers", headers=shop.staff).json() if o["code"] == "DIWALI20")["used"] == 0  # given back
    assert quote("DIWALI20")["totalPaise"] == 96_000


def test_lists_counts_and_who_can_remove_a_station(client, shop, book):
    first = book("10:00")
    book("12:00", pet=shop.luna, service=shop.cat_bath, confirm=False)
    listed = client.get(BOOKINGS, params={"stage": "confirmed,draft", "range": "next7", "pageSize": 1}, headers=shop.staff).json()
    assert listed["total"] == 2 and len(listed["items"]) == 1
    assert [b["pet"]["name"] for b in client.get(BOOKINGS, params={"petType": "cat"}, headers=shop.staff).json()["items"]] == ["Luna"]
    assert client.get(BOOKINGS, params={"range": "last30", "stage": "confirmed"}, headers=shop.staff).json()["total"] == 0
    counts = client.get(f"{BOOKINGS}/counts", headers=shop.staff).json()
    assert counts == {"draft": 1, "awaiting_payment": 0, "confirmed": 1, "completed": 0, "cancelled": 0, "no_show": 0}
    assert client.get(f"{BOOKINGS}/{first['id']}", headers=shop.staff).json()["id"] == first["id"]
    assert client.get(f"{BOOKINGS}/PP-1", headers=shop.staff).status_code == 404

    client.post("/api/admin/stations", json={"name": "Station 2", "canDo": "all"}, headers=shop.admin)
    busy = client.delete(f"/api/admin/stations/{first['stationId']}", headers=shop.admin)
    assert busy.status_code == 409 and busy.json()["detail"].startswith("1 upcoming booking is on Station 1.")
