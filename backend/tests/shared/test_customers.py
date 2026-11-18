"""Customers and pets: search, tabs and pages; one customer per number; pets belong to a customer."""

import pytest
from sqlalchemy.exc import IntegrityError

from app.shared.customers.models import Pet

CUSTOMERS = "/api/admin/customers"
PETS = "/api/admin/pets"


def add(client, headers, name, phone, *pets):
    c = client.post(CUSTOMERS, json={"name": name, "phone": phone}, headers=headers).json()
    for pet_name, kind in pets:
        client.post(f"{CUSTOMERS}/{c['id']}/pets", json={"name": pet_name, "type": kind}, headers=headers)
    return c


def test_customers_are_searched_and_paged(client, signed_in):
    staff = signed_in("staff")
    assert client.get(CUSTOMERS).status_code == 401
    for i in range(1, 12):
        add(client, staff, f"Customer {i:02}", f"98200000{i:02}", (f"Dog {i}", "dog"))
    add(client, staff, "Ananya Desai", "9822041763", ("Coco", "dog"), ("Luna", "cat"))

    def page(**params):
        return client.get(CUSTOMERS, params=params, headers=staff).json()

    first = page(pageSize=5, sort="name")
    assert first["total"] == 12 and first["page"] == 1 and len(first["items"]) == 5
    assert first["items"][0] | {"id": ""} == {"id": "", "name": "Ananya Desai", "phone": "9822041763", "petNames": ["Coco", "Luna"],
                                               "planName": None, "bookingsCount": 0, "spentPaise": 0, "lastVisit": None, "lapsed": False, "next": None}
    assert len(page(pageSize=5, page=3)["items"]) == 2  # 12 = 5 + 5 + 2

    def names(**params):
        return [c["name"] for c in page(sort="name", **params)["items"]]

    assert names(q="luna") == ["Ananya Desai"]  # a pet's name finds the owner
    assert names(q="20000003") == ["Customer 03"]  # part of the phone number
    assert names(q="041 763") == ["Ananya Desai"]  # spaces are ignored
    assert names(q="98") == []  # under 3 digits isn't a phone search
    assert names(petType="cat") == ["Ananya Desai"]
    assert names(q="50%") == []  # % is searched as a character, not a wildcard

    counts = client.get(f"{CUSTOMERS}/counts", headers=staff).json()
    assert counts == {"all": 12, "members": 0, "new": 12, "lapsed": 0, "no_plan": 12}  # members and visits come later
    assert page(segment="new")["total"] == 12 and page(segment="members")["total"] == 0


def test_one_customer_per_mobile_number(client, signed_in):
    staff = signed_in("staff")
    made = client.post(CUSTOMERS, json={"name": " Priya Sharma ", "phone": "+91 98765 43210", "email": "", "area": "Koregaon Park"}, headers=staff).json()
    assert (made["name"], made["phone"], made["email"], made["area"], made["pets"], made["plan"]) == ("Priya Sharma", "9876543210", None, "Koregaon Park", [], None)
    other = add(client, staff, "Rohan Mehta", "9765430981")

    def detail(method, url, body):
        return client.request(method, url, json=body, headers=staff).json()["detail"]

    assert detail("POST", CUSTOMERS, {"name": "Copy", "phone": "98765 43210"}) == "A customer with this number already exists."
    assert detail("PUT", f"{CUSTOMERS}/{other['id']}", {"name": "Rohan", "phone": "9876543210"}) == "Another customer already has this number."
    assert detail("POST", CUSTOMERS, {"name": " ", "phone": "9000000000"}) == "Enter the customer's name."
    assert detail("POST", CUSTOMERS, {"name": "A", "phone": "98765"}) == "Enter a 10-digit mobile number."
    assert detail("POST", CUSTOMERS, {"name": "A", "phone": "9000000000", "email": "a@b"}) == "That email doesn't look right."

    # New booking asks "do we know this number?" before adding someone.
    assert client.get(f"{CUSTOMERS}/lookup", params={"phone": "98765-43210"}, headers=staff).json()["id"] == made["id"]
    assert client.get(f"{CUSTOMERS}/lookup", params={"phone": "9000000000"}, headers=staff).json() is None

    noted = client.put(f"{CUSTOMERS}/{made['id']}/note", json={"text": " Prefers evening slots. "}, headers=staff).json()
    assert noted["staffNote"]["text"] == "Prefers evening slots." and noted["staffNote"]["by"] == "Amit J."
    assert client.put(f"{CUSTOMERS}/{made['id']}/note", json={"text": ""}, headers=staff).json()["staffNote"] is None
    assert client.get(f"{CUSTOMERS}/nope", headers=staff).status_code == 404


def test_pets_belong_to_a_customer(client, signed_in, db):
    staff = signed_in("staff")
    owner = add(client, staff, "Ananya Desai", "9822041763")
    url = f"{CUSTOMERS}/{owner['id']}/pets"
    coco = client.post(url, json={"name": "Coco", "type": "dog", "breed": " Shih Tzu ", "birthDate": "2022-06-01", "weightKg": 6,
                                  "vaccination": "due_soon", "notes": "Towel-dry first."}, headers=staff).json()
    luna = client.post(url, json={"name": "Luna", "type": "cat", "breed": "", "birthDate": "", "gender": "", "weightKg": 0, "vaccination": ""}, headers=staff).json()
    assert coco["breed"] == "Shih Tzu" and coco["birthDate"] == "2022-06-01"
    assert (luna["breed"], luna["birthDate"], luna["gender"], luna["weightKg"], luna["vaccination"]) == (None, None, None, None, "unknown")
    assert [p["name"] for p in client.get(f"{CUSTOMERS}/{owner['id']}", headers=staff).json()["pets"]] == ["Coco", "Luna"]

    def detail(body):
        return client.post(url, json=body, headers=staff).json()["detail"]

    assert detail({"name": " ", "type": "dog"}) == "Enter the pet's name."
    assert detail({"name": "Rex", "type": "rabbit"}) == "Is it a dog or a cat?"
    assert client.post(f"{CUSTOMERS}/nope/pets", json={"name": "Rex", "type": "dog"}, headers=staff).status_code == 404

    # The pets list searches the pet, its breed and its owner.
    other = add(client, staff, "Rohan Mehta", "9765430981", ("Bruno", "dog"))
    listed = client.get(PETS, params={"q": "ananya"}, headers=staff).json()
    assert [p["pet"]["name"] for p in listed["items"]] == ["Coco", "Luna"] and listed["items"][0]["owner"]["phone"] == "9822041763"
    assert [p["pet"]["name"] for p in client.get(PETS, params={"q": "shih"}, headers=staff).json()["items"]] == ["Coco"]
    assert [p["pet"]["name"] for p in client.get(PETS, params={"vaccinationDue": "true"}, headers=staff).json()["items"]] == ["Coco"]
    assert client.get(f"{PETS}/counts", headers=staff).json() == {"all": 3, "dog": 2, "cat": 1}

    record = client.get(f"{PETS}/{coco['id']}", headers=staff).json()
    assert record["owner"]["name"] == "Ananya Desai" and record["visits"] == [] and record["lastGroom"] is None
    renamed = client.put(f"{PETS}/{coco['id']}", json={"name": "Coco Chanel", "type": "dog"}, headers=staff).json()
    assert renamed["name"] == "Coco Chanel" and renamed["breed"] is None  # the form sends every detail; an empty one is cleared
    assert other["id"] != owner["id"]

    # The database itself refuses a pet whose owner doesn't exist (the foreign key).
    with pytest.raises(IntegrityError):
        db.add(Pet(customer_id="nobody", name="Ghost", type="dog"))
        db.commit()
    db.rollback()
