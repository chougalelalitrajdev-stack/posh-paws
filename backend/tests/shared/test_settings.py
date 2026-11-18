"""Settings sections, holidays and the usual week (root CLAUDE.md › Booking & payment rules; admin Settings and Availability)."""

from datetime import timedelta

from app.core.dates import today

SETTINGS = "/api/admin/settings"
WEEK = "/api/admin/slot-board/week"


def test_any_staff_member_reads_the_settings_and_a_fresh_database_has_defaults(client, signed_in):
    assert client.get(SETTINGS).status_code == 401
    s = client.get(SETTINGS, headers=signed_in("staff")).json()
    assert s["business"]["name"] == "Posh Paws Pet Grooming"
    assert s["booking"]["slotStepMinutes"] == 30 and len(s["booking"]["hours"]) == 7 and s["booking"]["closures"] == []
    assert s["booking"]["hours"][0] | {"day": 0} == {"day": 0, "open": True, "opens": "09:00", "closes": "19:00", "breakFrom": "14:00", "breakTo": "14:30", "closedStarts": [], "extraStarts": []}
    assert s["payments"]["slotHoldPaise"] == 10_000 and s["app"] == {"bookButtonText": "Book now", "showPrices": True}


def test_only_admins_save_sections_and_each_save_is_checked(client, signed_in):
    admin, staff = signed_in("admin"), signed_in("staff")
    business = {"name": "Posh Paws", "email": "hello@poshpaws.in", "phone": "  +91 98765 43210 "}
    assert client.put(f"{SETTINGS}/business", json=business, headers=staff).status_code == 403
    saved = client.put(f"{SETTINGS}/business", json=business, headers=admin)
    assert saved.status_code == 200 and saved.json()["business"]["phone"] == "+91 98765 43210"
    assert client.get(SETTINGS, headers=staff).json()["business"]["name"] == "Posh Paws"  # stored, not the default any more

    def detail(section, body):
        return client.put(f"{SETTINGS}/{section}", json=body, headers=admin).json()["detail"]

    assert detail("business", {"name": "  "}) == "Enter the business name."
    assert detail("business", {"name": "Posh Paws", "email": "hello"}) == "That email doesn't look right."
    assert detail("app", {"bookButtonText": "Book your pet's groom today", "showPrices": True}) == "Keep the Book button text to 1–20 characters."
    payments = {"linkExpiryHours": 24, "slotHoldPaise": 10_000, "freeCancellationHours": 24}
    assert detail("payments", {**payments, "upiId": "not a upi"}) == "That UPI ID doesn't look right (it looks like name@bank)."
    assert detail("payments", {**payments, "linkExpiryHours": 100}) == "Links can last 1 to 72 hours."
    assert detail("notifications", {"reminderTime": "6pm", "unpaidNudgeHours": 6, "staffAlerts": "admins"}) == "Pick a reminder time."


def test_saving_hours_checks_them_and_keeps_the_weekly_start_times(client, signed_in):
    admin = signed_in("admin")
    rules = client.get(SETTINGS, headers=admin).json()["booking"]
    client.put(f"{WEEK}/0", json={"time": "09:00", "open": False}, headers=admin)  # no 9:00 on Mondays

    hours = [{k: v for k, v in h.items() if k not in ("closedStarts", "extraStarts")} for h in rules["hours"]]
    hours[6]["open"] = False  # closed on Sundays
    body = {k: rules[k] for k in ("slotStepMinutes", "bufferMinutes", "bookAheadDays", "minNoticeMinutes")} | {"hours": hours}
    saved = client.put(f"{SETTINGS}/booking", json=body, headers=admin).json()["booking"]
    assert saved["hours"][0]["closedStarts"] == ["09:00"]  # kept, though the form didn't send it
    assert saved["hours"][6] | {"closedStarts": [], "extraStarts": []} == {**hours[6], "breakFrom": None, "breakTo": None, "closedStarts": [], "extraStarts": []}

    def detail(change):
        broken = [dict(h) for h in hours]
        change(broken)
        return client.put(f"{SETTINGS}/booking", json=body | {"hours": broken}, headers=admin).json()["detail"]

    assert detail(lambda h: h[1].update(breakFrom="08:00")) == "Tuesday: the break must be inside opening hours."
    assert detail(lambda h: h[2].update(closes="08:00")) == "Wednesday: closing time must be after opening time."
    assert detail(lambda h: [d.update(open=False) for d in h]) == "Open at least one day a week."


def test_any_staff_member_adds_and_removes_holidays(client, signed_in):
    staff = signed_in("staff")
    later, sooner = (today() + timedelta(days=20)).isoformat(), (today() + timedelta(days=10)).isoformat()
    added = client.post(f"{SETTINGS}/closures", json={"date": later, "name": "Diwali"}, headers=staff)
    assert added.status_code == 200
    assert added.json() | {"id": None} == {"id": None, "date": later, "name": "Diwali", "closesAt": None, "affectedBookings": 0}
    client.post(f"{SETTINGS}/closures", json={"date": sooner, "name": "Staff training", "closesAt": "14:00"}, headers=staff)

    def status(body):
        return client.post(f"{SETTINGS}/closures", json=body, headers=staff).status_code

    assert status({"date": later, "name": "Again"}) == 409
    assert status({"date": (today() - timedelta(days=1)).isoformat(), "name": "Yesterday"}) == 400
    assert status({"date": later}) == 422
    assert status({"date": later, "name": "Late", "closesAt": "2pm"}) == 422

    closures = client.get(SETTINGS, headers=staff).json()["booking"]["closures"]
    assert [c["name"] for c in closures] == ["Staff training", "Diwali"]  # in date order
    remaining = client.delete(f"{SETTINGS}/closures/{added.json()['id']}", headers=staff).json()["booking"]["closures"]
    assert [c["name"] for c in remaining] == ["Staff training"]
    assert client.delete(f"{SETTINGS}/closures/nope", headers=staff).status_code == 404


def test_the_usual_week(client, signed_in):
    admin, staff = signed_in("admin"), signed_in("staff")
    monday = {s["time"]: s["state"] for s in client.get(WEEK, headers=staff).json()["days"][0]["slots"]}
    assert monday["09:00"] == "open" and monday["14:00"] == "break" and monday["18:30"] == "open" and "19:00" not in monday

    assert client.put(f"{WEEK}/0", json={"time": "09:00", "open": False}, headers=staff).status_code == 403
    board = client.put(f"{WEEK}/0", json={"time": "09:00", "open": False}, headers=admin).json()
    assert next(s for s in board["days"][0]["slots"] if s["time"] == "09:00")["state"] == "closed"
    board = client.put(f"{WEEK}/5", json={"time": "19:00", "open": True}, headers=admin).json()  # extra every Saturday
    assert board["days"][5]["extraStarts"] == ["19:00"]
    board = client.put(f"{WEEK}/1", json={"time": "14:00", "open": True}, headers=admin).json()  # open the break on Tuesdays
    assert next(s for s in board["days"][1]["slots"] if s["time"] == "14:00")["state"] == "extra"

    assert client.put(f"{WEEK}/2", json={"time": "11:10", "open": False}, headers=admin).status_code == 404
    assert client.put(f"{WEEK}/2", json={"time": "7pm", "open": True}, headers=admin).status_code == 400
    assert client.put(f"{WEEK}/7", json={"time": "09:00", "open": True}, headers=admin).status_code == 422
