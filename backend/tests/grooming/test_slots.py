"""Open start times (root CLAUDE.md › Slots): hours, break, cleaning buffer, stations, holidays, day and week changes, block time."""

from datetime import timedelta

SLOTS = "/api/admin/slots"
BOARD = "/api/admin/slot-board"


def open_times(client, shop, service=None, date=None):
    days = client.get(SLOTS, params={"serviceId": service or shop.bath, "from": str(date or shop.tomorrow), "days": 1}, headers=shop.staff).json()
    return {s["time"]: s["available"] for s in days[0]["slots"]}


def test_start_times_follow_the_hours_break_and_cleaning_buffer(client, shop, book):
    times = open_times(client, shop)
    assert list(times)[0] == "09:00" and list(times)[-1] == "18:00"  # a 45-minute bath still fits at 18:00, not at 18:30
    assert not times["13:30"] and not times["14:00"] and times["13:00"]  # 13:30 + 45 min + 15 min cleaning runs into the 14:00 break

    book("10:00")
    times = open_times(client, shop)
    # 10:00–10:45 plus cleaning holds Station 1 until 11:00, and a visit needs its own cleaning time before the next one.
    assert (times["09:00"], times["09:30"], times["10:00"], times["10:30"], times["11:00"]) == (True, False, False, False, True)


def test_the_most_specialised_free_station_is_used_first(client, shop, book):
    client.post("/api/admin/stations", json={"name": "Cat corner", "canDo": "cats"}, headers=shop.admin)
    stations = {s["name"]: s["id"] for s in client.get("/api/admin/stations", headers=shop.staff).json()}

    luna = book("10:00", pet=shop.luna, service=shop.cat_bath)
    assert luna["stationId"] == stations["Cat corner"]  # keeps the all-round table free for dogs
    coco = book("10:00")
    assert coco["stationId"] == stations["Station 1"]
    assert not open_times(client, shop)["10:00"]  # a dog can't use the cat corner
    assert not open_times(client, shop, service=shop.cat_bath)["10:00"]  # both stations are busy now


def test_holidays_and_day_and_week_changes(client, shop):
    date = shop.tomorrow
    client.post("/api/admin/settings/closures", json={"date": str(date), "name": "Team outing", "closesAt": "15:00"}, headers=shop.staff)
    times = open_times(client, shop)
    assert times["13:00"] and not times["14:30"] and not times["15:00"]  # 14:30 + 45 min + 15 min cleaning runs past the 15:00 closing
    board = client.get(BOARD, params={"date": str(date)}, headers=shop.staff).json()
    assert board["closure"] == {"name": "Team outing", "closesAt": "15:00"}
    assert next(s for s in board["slots"] if s["time"] == "16:00")["blockedBy"] == "Closed · Team outing"

    # Close 11:00 just for that day, and open an extra 19:00 start (after hours).
    assert client.put(f"{BOARD}/{date}", json={"time": "11:00", "open": False}, headers=shop.staff).status_code == 200
    board = client.put(f"{BOARD}/{date}", json={"time": "19:00", "open": True}, headers=shop.staff).json()
    states = {s["time"]: s["state"] for s in board["slots"]}
    assert states["11:00"] == "closed" and states["19:00"] == "extra"
    times = open_times(client, shop)
    assert "11:00" not in times and times["19:00"]  # an extra time skips the hours and the holiday, but not bookings
    reopened = client.put(f"{BOARD}/{date}", json={"time": "11:00", "open": True}, headers=shop.staff).json()
    assert next(s for s in reopened["slots"] if s["time"] == "11:00")["state"] == "open"

    # Every week on that weekday: 09:00 closed (Admins change the usual week).
    client.put(f"/api/admin/slot-board/week/{date.weekday()}", json={"time": "09:00", "open": False}, headers=shop.admin)
    assert "09:00" not in open_times(client, shop) and "09:00" in open_times(client, shop, date=date + timedelta(days=1))

    def detail(body, day=date):
        return client.put(f"{BOARD}/{day}", json=body, headers=shop.staff).json()["detail"]

    assert detail({"time": "9am", "open": False}) == "Enter a time like 18:30."
    assert detail({"time": "12:00", "open": False}, shop.tomorrow - timedelta(days=2)) == "That time has passed."
    assert detail({"time": "12:00", "open": False}, shop.tomorrow + timedelta(days=60)) == "Bookings open 30 days ahead; change this day nearer the time."


def test_a_closed_day_has_no_start_times(client, shop):
    client.post("/api/admin/settings/closures", json={"date": str(shop.tomorrow), "name": "Diwali"}, headers=shop.staff)
    assert open_times(client, shop) == {}
    later = open_times(client, shop, date=shop.tomorrow + timedelta(days=31))
    assert later and not any(later.values())  # beyond the 30 days ahead: listed, but not bookable yet


def test_block_time_on_one_station(client, shop, book):
    station = client.get("/api/admin/stations", headers=shop.staff).json()[0]["id"]
    blocks = "/api/admin/blocks"
    block = client.post(blocks, json={"stationId": station, "date": str(shop.tomorrow), "time": "12:00", "durationMinutes": 60, "reason": "Team meeting"},
                        headers=shop.staff).json()
    assert block["reason"] == "Team meeting" and block["fixed"] is False
    times = open_times(client, shop)
    assert not times["11:30"] and not times["12:30"] and times["13:00"]

    book("10:00")

    def detail(body):
        return client.post(blocks, json={"stationId": station, "date": str(shop.tomorrow), **body}, headers=shop.staff).json()["detail"]

    assert detail({"time": "10:30", "durationMinutes": 30}) == "That time overlaps a booking or another block on this station."
    assert detail({"time": "16:00", "durationMinutes": 10}) == "Block at least 15 minutes."
    assert detail({"durationMinutes": 30}) == "Pick a start time."

    calendar = client.get("/api/admin/calendar", params={"from": str(shop.tomorrow)}, headers=shop.staff).json()
    assert [b["reason"] for b in calendar["blocks"]] == ["Break", "Team meeting"] and calendar["blocks"][0]["fixed"] is True
    assert [b["time"] for b in calendar["bookings"]] == ["10:00"] and (calendar["opens"], calendar["closes"]) == ("09:00", "19:00")

    assert client.delete(f"{blocks}/{block['id']}", headers=shop.staff).status_code == 204
    assert open_times(client, shop)["12:00"]
    assert client.delete(f"{blocks}/{block['id']}", headers=shop.staff).status_code == 404

    # A station's day off: opening to closing, whatever time is sent.
    day_off = client.post(blocks, json={"stationId": station, "date": str(shop.tomorrow + timedelta(days=1)), "allDay": True}, headers=shop.staff).json()
    assert (day_off["time"], day_off["durationMinutes"], day_off["reason"]) == ("09:00", 600, "Day off")
