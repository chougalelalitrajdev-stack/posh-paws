"""Membership plans (Catalog › Membership plans)."""

PLANS = "/api/admin/plans"

BASIC = {
    "name": "Basic", "tagline": "For the occasional visit", "pricePaise": 49_900, "billing": "month", "sessionsPerPeriod": 2,
    "discountPercent": 0, "eligibleServiceIds": [], "featured": False, "subscribable": True,
    "benefits": [{"text": " 2 grooming sessions ", "included": True}, {"text": "", "included": True}, {"text": "Post-groom photos", "included": False}],
}


def test_plans_have_unique_names_and_one_featured(client, signed_in):
    admin, staff = signed_in("admin"), signed_in("staff")
    assert client.post(PLANS, json=BASIC, headers=staff).status_code == 403
    basic = client.post(PLANS, json=BASIC, headers=admin).json()
    assert basic["benefits"] == [{"text": "2 grooming sessions", "included": True}, {"text": "Post-groom photos", "included": False}]
    assert basic["activeSubscribers"] == 0

    posh = client.post(PLANS, json={**BASIC, "name": "Posh", "featured": True, "sessionsPerPeriod": None}, headers=admin).json()
    assert posh["sessionsPerPeriod"] is None  # unlimited
    client.put(f"{PLANS}/{basic['id']}", json={**BASIC, "featured": True}, headers=admin)
    listed = client.get(PLANS, headers=staff).json()
    assert [(p["name"], p["featured"]) for p in listed] == [("Basic", True), ("Posh", False)]  # the badge moved

    def detail(**change):
        return client.post(PLANS, json={**BASIC, "name": "Royal", **change}, headers=admin).json()["detail"]

    assert detail(name="posh") == "Another plan already has this name."
    assert detail(name=" ") == "Enter a plan name."
    assert detail(pricePaise=0) == "Enter a price in whole rupees."
    assert detail(sessionsPerPeriod=0) == "Sessions must be 1 or more, or unlimited."
    assert detail(discountPercent=95) == "Discount must be between 0% and 90%."
    assert detail(billing="week") == "Pick how often it's billed."
    assert client.put(f"{PLANS}/nope", json=BASIC, headers=admin).status_code == 404
