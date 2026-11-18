"""Money on a booking (root CLAUDE.md › Booking & payment rules): links, the advance, shop payments, checkout, the refund rule,
the Payments page and Today."""

from datetime import timedelta

from app.core.dates import today
from app.grooming.bookings.models import Booking
from app.shared.payments.models import PaymentLink

BOOKINGS = "/api/admin/bookings"


def act(client, shop, booking_id, action, body=None):
    return client.post(f"{BOOKINGS}/{booking_id}/{action}", json=body or {}, headers=shop.staff)


def move_to(db, booking_id, day):
    """Puts a booking on another day (tests can't wait for time to pass)."""
    db.get(Booking, booking_id).date = day
    db.commit()


def test_a_link_holds_the_slot_and_paying_it_confirms(client, shop, book):
    draft = book("10:00", confirm=False)
    sent = act(client, shop, draft["id"], "payment-link", {"amountType": "hold"}).json()
    assert (sent["stage"], sent["paymentStatus"], sent["paymentLink"]["amountType"], sent["paymentLink"]["amountPaise"]) == ("awaiting_payment", "link_sent", "hold", 10_000)
    assert sent["stationId"] and sent["activity"][0]["title"] == "Payment link sent on WhatsApp"
    details = {"customerId": shop.customer, "petId": shop.coco, "serviceId": shop.bath, "date": str(shop.tomorrow), "time": "10:00"}
    assert client.post(BOOKINGS, json=details, headers=shop.staff).status_code == 409  # the link holds the slot while it's paid

    again = act(client, shop, draft["id"], "payment-link", {"amountType": "full"}).json()
    assert again["paymentLink"]["amountType"] == "hold" and again["paymentLink"]["url"] != sent["paymentLink"]["url"]  # a re-send asks the same
    assert again["activity"][0]["title"] == "New payment link sent"

    paid = act(client, shop, draft["id"], "demo-pay").json()
    assert (paid["stage"], paid["paymentStatus"], paid["paymentLink"]) == ("confirmed", "part_paid", None)
    assert paid["payments"][0] | {"at": ""} == {"id": f"PAY-{draft['id'][3:]}-1", "kind": "advance", "amountPaise": 10_000, "method": "online", "at": "",
                                                "by": None, "refundOf": None}
    assert (paid["bill"]["paidPaise"], paid["bill"]["balancePaise"]) == (10_000, 110_000)

    def detail(body):
        return act(client, shop, draft["id"], "payments", body).json()["detail"]

    assert detail({"amountPaise": 200_000, "method": "cash"}) == "The balance is ₹1,100. Enter that or less."
    assert detail({"amountPaise": 0, "method": "cash"}) == "Enter the amount received."
    assert detail({"amountPaise": 100, "method": "cheque"}) == "Pick how they paid: shop QR, cash or card."
    settled = act(client, shop, draft["id"], "payments", {"amountPaise": 110_000, "method": "cash"}).json()
    assert settled["paymentStatus"] == "paid" and settled["activity"][0]["detail"] == "₹1,100 by Cash · paid in full"
    assert act(client, shop, draft["id"], "payment-link").json()["detail"] == "Nothing left to pay on this booking."


def test_checkout_takes_the_balance_and_completes(client, shop, book, db):
    b = book("10:00")
    assert b["paymentStatus"] == "unpaid" and b["bill"]["advancePaise"] == 0  # a phone booking: no advance
    early = act(client, shop, b["id"], "payments", {"amountPaise": 50_000, "method": "upi_qr", "complete": True})
    assert early.status_code == 409  # checkout only once the appointment has started

    move_to(db, b["id"], today() - timedelta(days=1))
    link = act(client, shop, b["id"], "payment-link").json()["paymentLink"]
    assert (link["amountType"], link["amountPaise"]) == ("full", 120_000)  # after confirming, a link asks for the balance
    part = act(client, shop, b["id"], "payments", {"amountPaise": 50_000, "method": "upi_qr", "complete": True}).json()
    assert (part["stage"], part["paymentStatus"]) == ("completed", "part_paid")
    assert [a["title"] for a in part["activity"][:2]] == ["Marked completed", "Payment taken at the shop"]
    assert part["activity"][0]["detail"] == "₹700 still to pay." and part["paymentLink"]  # the balance link stays open for the rest
    rest = act(client, shop, b["id"], "payments", {"amountPaise": 70_000, "method": "card"}).json()
    assert (rest["paymentStatus"], rest["paymentLink"]) == ("paid", None)


def test_cancelling_refunds_the_advance_only_when_early(client, shop, book):
    def paid_advance(days_ahead):
        b = book("10:00", date=today() + timedelta(days=days_ahead), confirm=False)
        act(client, shop, b["id"], "payment-link", {"amountType": "hold"})
        return act(client, shop, b["id"], "demo-pay").json()

    early = act(client, shop, paid_advance(3)["id"], "cancel", {"reason": "Travelling"}).json()
    assert (early["stage"], early["paymentStatus"], early["bill"]["paidPaise"]) == ("cancelled", "refunded", 0)
    assert early["payments"][-1]["kind"] == "refund" and early["payments"][-1]["refundOf"] == early["payments"][0]["id"]
    assert early["activity"][0]["detail"] == "Travelling The ₹100 advance was refunded (cancelled 24 h or more before)."

    # Cancelled less than freeCancellationHours before: the advance is kept.
    client.put("/api/admin/settings/payments", json={"linkExpiryHours": 24, "slotHoldPaise": 10_000, "freeCancellationHours": 168}, headers=shop.admin)
    late = act(client, shop, paid_advance(4)["id"], "cancel").json()
    assert (late["paymentStatus"], late["bill"]["paidPaise"], late["bill"]["balancePaise"]) == ("paid", 10_000, 0)
    assert late["activity"][0]["detail"] == "The ₹100 advance is kept (cancelled less than 168 h before)."


def test_the_payments_page_and_refunds(client, shop, book, signed_in):
    owner = signed_in("super_admin")
    a = book("10:00", confirm=False)
    act(client, shop, a["id"], "payment-link", {"amountType": "hold"})
    act(client, shop, a["id"], "demo-pay")  # ₹100 online
    act(client, shop, a["id"], "payments", {"amountPaise": 50_000, "method": "cash"})  # ₹500 cash, ₹600 still due
    b = book("12:00", pet=shop.luna, service=shop.cat_bath, confirm=False)
    act(client, shop, b["id"], "payment-link")  # ₹900 link waiting

    period = {"from": str(today()), "to": str(today())}
    rows = client.get("/api/admin/payments", params=period, headers=shop.staff).json()["items"]
    assert sorted((r["id"], r["status"], r["amountPaise"]) for r in rows) == sorted([
        (f"PAY-{a['id'][3:]}-1", "paid", 10_000), (f"PAY-{a['id'][3:]}-2", "paid", 50_000), (f"{a['id']}-DUE", "due", 60_000), (f"{b['id']}-LINK", "link_sent", 90_000)])
    cash = next(r for r in rows if r["id"].endswith("-2"))
    assert (cash["detail"], cash["item"], cash["customer"]["name"], cash["refundable"]) == ("Balance · Cash", "Signature Bath", "Ananya Desai", True)
    assert [r["status"] for r in client.get("/api/admin/payments", params={**period, "tab": "waiting"}, headers=shop.staff).json()["items"]] == ["link_sent"]
    summary = client.get("/api/admin/payments/summary", params=period, headers=shop.staff).json()
    assert summary | {} == {"collectedPaise": 60_000, "collectedCount": 2, "waitingPaise": 90_000, "waitingCount": 1, "duePaise": 60_000, "dueCount": 1,
                            "failedCount": 0, "refundedPaise": 0, "refundedCount": 0}
    yesterday = {"from": str(today() - timedelta(days=1)), "to": str(today() - timedelta(days=1))}
    assert {r["status"] for r in client.get("/api/admin/payments", params=yesterday, headers=shop.staff).json()["items"]} == {"due", "link_sent"}  # open money shows in any period

    url = f"/api/admin/payments/{cash['id']}/refund"
    assert client.post(url, headers=shop.admin).status_code == 403  # Super Admin only
    back = client.post(url, headers=owner).json()
    assert (back["status"], back["amountPaise"], back["detail"]) == ("refunded", 50_000, "Refund · Cash")
    assert client.post(url, headers=owner).json()["detail"] == "This payment has already been refunded."
    after = client.get(f"{BOOKINGS}/{a['id']}", headers=shop.staff).json()
    assert (after["bill"]["paidPaise"], after["paymentStatus"], after["activity"][0]["title"]) == (10_000, "part_paid", "Payment refunded")

    tab = client.get(f"/api/admin/customers/{shop.customer}/payments", headers=shop.staff).json()
    assert len(tab) == 5 and tab == sorted(tab, key=lambda r: r["at"], reverse=True)


def test_today_shows_what_needs_a_person(client, shop, book, db):
    done = book("10:00")
    move_to(db, done["id"], today() - timedelta(days=1))  # over, but nobody said whether Coco came
    book(None, pet=shop.luna, service=shop.cat_bath, confirm=False)  # a draft left unfinished
    waiting = book("12:00", confirm=False)
    act(client, shop, waiting["id"], "payment-link")
    link = db.query(PaymentLink).filter_by(booking_id=waiting["id"]).one()
    link.sent_at -= timedelta(hours=7)  # older than the 6 h nudge
    db.commit()
    act(client, shop, done["id"], "payments", {"amountPaise": 20_000, "method": "cash"})

    today_screen = client.get("/api/admin/dashboard", headers=shop.staff).json()
    kinds = [(i["kind"], i["title"]) for i in today_screen["attention"]]
    assert ("visit", "Did Coco come in?") in kinds and ("draft", "Booking left unfinished") in kinds and ("unpaid", "Payment link not paid yet") in kinds
    visit = next(i for i in today_screen["attention"] if i["kind"] == "visit")
    assert visit["bookingId"] == done["id"] and visit["balancePaise"] == 100_000 and visit["detail"].endswith("Ananya Desai · ₹1,000 to pay")
    assert today_screen["awaitingPayment"] == {"count": 1, "outstandingPaise": 120_000, "failed": 0}
    assert today_screen["payments"]["totalPaise"] == 20_000 and today_screen["payments"]["days"][-1] == {"date": str(today()), "amountPaise": 20_000}
    assert today_screen["openStations"] == 1 and today_screen["memberships"]["active"] == 0 and today_screen["content"] == []
