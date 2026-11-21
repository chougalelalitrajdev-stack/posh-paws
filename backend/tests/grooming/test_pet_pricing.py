"""Pet pricing (root CLAUDE.md › The bill): a pet's breed, weight and coat add ₹ extras to services that have pet pricing on, set on
Catalog › Pet pricing. Discounts come after: a plan session covers everything, a percentage is taken from the price for the pet."""

from datetime import timedelta

from sqlalchemy import select

from app.core.dates import today
from app.grooming.plans.models import Plan
from app.grooming.subscriptions.models import SUBSCRIPTION_NUMBER, Subscription
from app.shared.customers.models import Pet

PRICING = "/api/admin/pet-pricing"
QUOTE = "/api/admin/bookings/quote"


def set_extras(client, shop, bands=(0, 150, 300, 500), coats=(0, 150, 250), breeds=None):
    """Dog extras in rupees: weight bands (up to 10, 25, 40 kg, then over), single / double / triple coat, and {breed name: extra}."""
    doc = client.get(PRICING, headers=shop.staff).json()
    dog = doc["dog"]
    for band, rupees in zip(dog["weightBands"], bands):
        band["extraPaise"] = rupees * 100
    for coat in dog["coats"]:
        coat["extraPaise"] = dict(zip(("single", "double", "triple"), coats))[coat["type"]] * 100
    for breed in dog["breeds"]:
        breed["extraPaise"] = (breeds or {}).get(breed["name"], 0) * 100
    reply = client.put(PRICING, json=doc, headers=shop.admin)
    assert reply.status_code == 200, reply.text
    return reply.json()


def quote(client, shop, pet=None, service=None, code=None):
    return client.post(QUOTE, json={"customerId": shop.customer, "petId": pet or shop.coco, "serviceId": service or shop.bath, "offerCode": code},
                       headers=shop.staff).json()


def edit_coco(client, shop, **changes):
    body = {"name": "Coco", "type": "dog", "breedId": "dog-indie", "weightKg": 8, "coatType": "single", **changes}
    reply = client.put(f"/api/admin/pets/{shop.coco}", json=body, headers=shop.staff)
    assert reply.status_code == 200, reply.text


def test_a_fresh_shop_has_the_usual_bands_and_coats_at_no_extra(client, shop):
    doc = client.get(PRICING, headers=shop.staff).json()
    assert [b["upToKg"] for b in doc["dog"]["weightBands"]] == [10, 25, 40, None] and [b["upToKg"] for b in doc["cat"]["weightBands"]] == [4, 7, None]
    assert [c["label"] for c in doc["dog"]["coats"]] == ["Single coat", "Double coat", "Triple coat"] and doc["dog"]["coats"][1]["note"]
    saved = client.put(PRICING, json=doc, headers=shop.admin).json()  # stored and read back: still single, double, triple
    assert [c["type"] for c in saved["dog"]["coats"]] == ["single", "double", "triple"]
    assert [c["type"] for c in client.get("/api/pet-options").json()["cat"]["coats"]] == ["single", "double", "triple"]
    assert doc["dog"]["breeds"][0]["name"] == "Indie" and doc["dog"]["breeds"][-1]["name"] == "Other"
    assert all(x["extraPaise"] == 0 for t in ("dog", "cat") for x in doc[t]["breeds"] + doc[t]["weightBands"] + doc[t]["coats"])
    assert quote(client, shop)["extras"] == [] and quote(client, shop)["totalPaise"] == 120_000

    # The customer app's pet form: breeds and coat notes, no prices (those come with the bill). Anyone may read it.
    options = client.get("/api/pet-options").json()
    assert set(options["dog"]) == {"breeds", "coats"} and set(options["dog"]["breeds"][0]) == {"id", "name"}
    assert set(options["dog"]["coats"][0]) == {"type", "label", "note"}


def test_breed_weight_and_coat_add_to_the_bill(client, shop):
    assert client.put(PRICING, json=client.get(PRICING, headers=shop.staff).json(), headers=shop.staff).status_code == 403  # Admins set prices
    set_extras(client, shop, breeds={"Golden Retriever": 100})

    edit_coco(client, shop, breedId="dog-golden-retriever", weightKg=31, coatType="double")
    bill = quote(client, shop)
    assert bill["extras"] == [{"label": "Golden Retriever", "amountPaise": 10_000}, {"label": "25–40 kg", "amountPaise": 30_000},
                              {"label": "Double coat", "amountPaise": 15_000}]
    assert (bill["servicePricePaise"], bill["subtotalPaise"], bill["totalPaise"]) == (120_000, 175_000, 175_000)

    edit_coco(client, shop, weightKg=10)  # exactly on a band's limit counts in that band; ₹0 extras aren't listed
    assert quote(client, shop)["extras"] == []
    edit_coco(client, shop, weightKg=41)
    assert quote(client, shop)["extras"] == [{"label": "Over 40 kg", "amountPaise": 50_000}]

    # A service with pet pricing off (an add-on) costs the same for any pet.
    trim = client.post("/api/admin/services", json={"name": "Nail Trim", "petType": "dog", "category": "Add-on", "durationMinutes": 15,
                                                    "pricePaise": 30_000, "petPricing": False}, headers=shop.admin).json()
    assert quote(client, shop, service=trim["id"])["totalPaise"] == 30_000


def test_discounts_come_after_the_extras(client, shop, db):
    set_extras(client, shop)
    edit_coco(client, shop, weightKg=30, coatType="double")  # +₹300 +₹150: ₹1,650 for Coco
    assert quote(client, shop, code=None)["subtotalPaise"] == 165_000

    offer = {"title": "Diwali week", "code": "DIWALI20", "discountType": "percent", "value": 20, "appliesTo": "all_services", "serviceIds": [],
             "startsOn": str(today()), "endsOn": str(today() + timedelta(days=7)), "totalUses": None, "perCustomer": None, "newCustomersOnly": False}
    client.post("/api/admin/offers", json=offer, headers=shop.admin)
    assert quote(client, shop, code="DIWALI20")["totalPaise"] == 132_000  # 20% of ₹1,650

    plan = Plan(name="Posh", price_paise=99_900, billing="month", sessions_per_period=5, discount_percent=10, eligible_service_ids=[shop.bath],
                featured=False, subscribable=True, sort_order=0, benefits=[])
    db.add(plan)
    db.flush()
    db.add(Subscription(id=f"SUB-{db.scalar(select(SUBSCRIPTION_NUMBER.next_value()))}", customer_id=shop.customer, plan_id=plan.id,
                        plan_name="Posh", price_paise=99_900, sessions_total=5, sessions_used=0, status="active",
                        started_on=today() - timedelta(days=10), renews_on=today() + timedelta(days=20)))
    db.commit()
    session = quote(client, shop)
    assert session["discount"]["kind"] == "session" and session["totalPaise"] == 0  # a plan session covers the extras too


def test_details_must_be_filled_in_and_corrections_reprice_upcoming_bookings(client, shop, book, db):
    set_extras(client, shop)
    # A pet added before breed, weight and coat were required can't be priced until they're filled in.
    old = Pet(customer_id=shop.customer, name="Tiger", type="dog")
    db.add(old)
    db.commit()
    assert quote(client, shop, pet=old.id)["detail"] == "Add Tiger's breed, weight and coat first. They set the price."

    booking = book("10:00")  # Coco: 8 kg, single coat, so ₹1,200
    assert booking["bill"]["totalPaise"] == 120_000
    edit_coco(client, shop, weightKg=32, coatType="triple")  # staff weigh Coco at the shop: +₹300 +₹250
    again = client.get(f"/api/admin/bookings/{booking['id']}", headers=shop.staff).json()
    assert again["bill"]["totalPaise"] == 175_000 and [e["label"] for e in again["bill"]["extras"]] == ["25–40 kg", "Triple coat"]
    assert again["activity"][0]["title"] == "Price updated" and again["activity"][0]["by"] == "Amit J."
    assert "₹1,200 → ₹1,750" in again["activity"][0]["detail"]


def test_breeds_are_edited_and_archived_never_lost(client, shop):
    doc = client.get(PRICING, headers=shop.staff).json()
    indie = doc["dog"]["breeds"][0]
    doc["dog"]["breeds"] = [{"name": "Shih Tzu mix", "extraPaise": 5_000}, {**indie, "name": "Indie (desi)"}]  # every other dog breed is left out
    saved = client.put(PRICING, json=doc, headers=shop.admin).json()
    assert [b["name"] for b in saved["dog"]["breeds"]] == ["Shih Tzu mix", "Indie (desi)"] and saved["dog"]["breeds"][0]["id"]
    coco = client.get(f"/api/admin/pets/{shop.coco}", headers=shop.staff).json()["pet"]
    assert coco["breed"] == "Indie (desi)"  # renamed, same breed

    # A pet keeps a breed that was taken off the list, but a new pet can't pick it.
    beagle = {"name": "Max", "type": "dog", "breedId": "dog-beagle", "weightKg": 10, "coatType": "double"}
    assert client.post(f"/api/admin/customers/{shop.customer}/pets", json=beagle, headers=shop.staff).json()["detail"] == "Pick a dog breed from the list."

    def refused(change):
        bad = client.get(PRICING, headers=shop.staff).json()
        change(bad["dog"])
        return client.put(PRICING, json=bad, headers=shop.admin).json()["detail"]

    assert refused(lambda d: d["breeds"].append({"name": "shih tzu MIX"})) == "Each breed can be listed once."
    assert refused(lambda d: d["weightBands"].insert(1, {"upToKg": 5, "extraPaise": 0})) == "Each weight band must go higher than the one before."
    assert refused(lambda d: d["weightBands"][-1].update(upToKg=60)) == "Weight bands go up to a weight each, and the last one covers everything above."
    assert refused(lambda d: d["coats"][0].update(extraPaise=-100)) == "Enter each extra in whole rupees, from ₹0 to ₹10,000."
