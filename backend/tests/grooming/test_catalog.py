"""Services (Catalog › Services) and stations (Availability › Stations)."""

SERVICES = "/api/admin/services"
STATIONS = "/api/admin/stations"

BATH = {"name": " Signature Bath ", "petType": "dog", "category": "Bath", "description": "A deep cleanse.", "durationMinutes": 45, "pricePaise": 120_000}


def test_services_are_ordered_archived_and_checked(client, signed_in):
    admin, staff = signed_in("admin"), signed_in("staff")
    assert client.post(SERVICES, json=BATH, headers=staff).status_code == 403  # staff read the catalog, Admins change it
    bath = client.post(SERVICES, json=BATH, headers=admin).json()
    assert bath | {"id": "x"} == {**BATH, "id": "x", "name": "Signature Bath", "imageUrl": None, "visible": True, "archived": False,
                                  "sortOrder": 0, "upcomingBookings": 0}
    trim = client.post(SERVICES, json={**BATH, "name": "Nail Trim", "category": "Add-on"}, headers=admin).json()
    cat = client.post(SERVICES, json={**BATH, "name": "Cat Bath", "petType": "cat"}, headers=admin).json()
    assert [s["name"] for s in client.get(SERVICES, headers=staff).json()] == ["Cat Bath", "Signature Bath", "Nail Trim"]

    # Reordering one pet type; another pet type's id is ignored.
    listed = client.put(f"{SERVICES}/order", json={"petType": "dog", "ids": [trim["id"], bath["id"], cat["id"]]}, headers=admin).json()
    assert [s["name"] for s in listed] == ["Cat Bath", "Nail Trim", "Signature Bath"]

    # Moving a service to cats puts it last there.
    moved = client.put(f"{SERVICES}/{trim['id']}", json={**BATH, "name": "Nail Trim", "petType": "cat"}, headers=admin).json()
    assert moved["petType"] == "cat" and moved["sortOrder"] == 1

    archived = client.post(f"{SERVICES}/{bath['id']}/archive", headers=admin).json()
    assert archived["archived"] is True and archived["visible"] is False  # gone from the app
    restored = client.post(f"{SERVICES}/{bath['id']}/restore", headers=admin).json()
    assert restored["archived"] is False and restored["visible"] is False  # staff show it again when ready
    assert client.post(f"{SERVICES}/nope/archive", headers=admin).status_code == 404

    def detail(**change):
        return client.post(SERVICES, json={**BATH, **change}, headers=admin).json()["detail"]

    assert detail(name="  ") == "Enter a name."
    assert detail(petType="rabbit") == "Is it for dogs or cats?"
    assert detail(category="Spa") == "Pick a category."
    assert detail(pricePaise=0) == "Enter a price in whole rupees."
    assert detail(durationMinutes=0) == "Pick a duration."
    assert detail(description="x" * 141) == "Keep the description under 140 characters."


def test_stations_keep_one_in_use_and_check_what_they_can_do(client, signed_in):
    admin, staff = signed_in("admin"), signed_in("staff")
    first = client.get(STATIONS, headers=staff).json()
    assert [(s["name"], s["canDo"], s["active"]) for s in first] == [("Station 1", "all", True)]  # a fresh shop has one

    bath = client.post(SERVICES, json=BATH, headers=admin).json()
    corner = {"name": "Bath corner", "canDo": "some", "serviceIds": [bath["id"], "unknown", bath["id"]]}
    assert client.post(STATIONS, json=corner, headers=staff).status_code == 403
    made = client.post(STATIONS, json=corner, headers=admin).json()
    assert made["serviceIds"] == [bath["id"]] and made["active"] is True  # only real services, once each

    def detail(method, url, body):
        return client.request(method, url, json=body, headers=admin).json()["detail"]

    assert detail("POST", STATIONS, {"name": "station 1", "canDo": "all"}) == "There's already a station called station 1."
    assert detail("POST", STATIONS, {"name": "Table 3", "canDo": "some", "serviceIds": ["unknown"]}) == "Pick at least one service it can do."
    assert detail("POST", STATIONS, {"name": " ", "canDo": "all"}) == "Name the station, e.g. Table 3 or Cat corner."
    assert detail("POST", STATIONS, {"name": "Table 3", "canDo": "birds"}) == "Pick what the station can do."

    # Switching both off would leave nowhere to book.
    off = client.put(f"{STATIONS}/{made['id']}", json={**corner, "active": False}, headers=admin)
    assert off.status_code == 200 and off.json()["active"] is False
    assert detail("PUT", f"{STATIONS}/{first[0]['id']}", {"name": "Station 1", "canDo": "all", "active": False}) == "Keep at least one station in use."
    assert client.delete(f"{STATIONS}/{first[0]['id']}", headers=admin).status_code == 409

    assert client.delete(f"{STATIONS}/{made['id']}", headers=admin).status_code == 204
    assert [s["name"] for s in client.get(STATIONS, headers=staff).json()] == ["Station 1"]
