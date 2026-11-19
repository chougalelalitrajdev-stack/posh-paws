"""The customer app's public data (no login): it shows what customers should see, and nothing private."""

from datetime import timedelta

from app.core.dates import today


def test_services_plans_and_shop_show_only_whats_public(client, signed_in):
    admin = signed_in("admin")
    bath = {"name": "Signature Bath", "petType": "dog", "category": "Bath", "durationMinutes": 45, "pricePaise": 120_000, "description": "A deep cleanse."}
    shown = client.post("/api/admin/services", json=bath, headers=admin).json()
    client.post("/api/admin/services", json={**bath, "name": "Staff-only trim", "visible": False}, headers=admin)
    gone = client.post("/api/admin/services", json={**bath, "name": "Old service"}, headers=admin).json()
    client.post(f"/api/admin/services/{gone['id']}/archive", headers=admin)

    services = client.get("/api/services").json()
    assert services == [{"id": shown["id"], "petType": "dog", "icon": "🛁", "name": "Signature Bath", "description": "A deep cleanse.",
                         "pricePaise": 120_000, "durationMinutes": 45, "imageUrl": None}]  # no hidden or archived ones, no internal fields

    plan = {"name": "Posh", "tagline": "For the devoted", "pricePaise": 99_900, "billing": "month", "sessionsPerPeriod": 5, "discountPercent": 10,
            "eligibleServiceIds": [shown["id"]], "featured": True, "subscribable": True, "benefits": [{"text": "5 sessions", "included": True}]}
    client.post("/api/admin/plans", json=plan, headers=admin)
    client.post("/api/admin/plans", json={**plan, "name": "Staff plan", "featured": False, "subscribable": False}, headers=admin)
    plans = client.get("/api/plans").json()
    assert [p["name"] for p in plans] == ["Posh"] and plans[0]["badge"] == "Most popular"
    assert set(plans[0]) == {"id", "name", "tagline", "pricePaise", "billing", "featured", "badge", "features"}  # the session rules stay private

    assert client.get("/api/shop").json() == {"advancePaise": 10_000, "freeCancellationHours": 24, "upiId": "", "qrImageUrl": None}


def test_open_times_only_for_services_the_app_shows(client, signed_in):
    admin = signed_in("admin")
    client.get("/api/admin/stations", headers=admin)
    bath = {"name": "Bath", "petType": "dog", "category": "Bath", "durationMinutes": 45, "pricePaise": 120_000}
    shown = client.post("/api/admin/services", json=bath, headers=admin).json()
    hidden = client.post("/api/admin/services", json={**bath, "name": "Staff only", "visible": False}, headers=admin).json()
    tomorrow = str(today() + timedelta(days=1))
    times = client.get("/api/slots", params={"date": tomorrow, "serviceId": shown["id"]}).json()
    assert times[0] == {"time": "09:00", "available": True}
    assert client.get("/api/slots", params={"date": tomorrow, "serviceId": hidden["id"]}).status_code == 404


def test_content_shows_only_whats_published(client, signed_in):
    admin = signed_in("admin")
    t = today()
    hero = {"placement": "home_hero", "title": "Diwali week", "buttonText": "Book now", "link": "book", "startsOn": str(t)}
    client.post("/api/admin/banners", json={**hero, "title": "Coming soon", "startsOn": str(t + timedelta(days=5))}, headers=admin)
    live = client.post("/api/admin/banners", json=hero, headers=admin).json()
    paused = client.post("/api/admin/banners", json={**hero, "placement": "services", "title": "Paused"}, headers=admin).json()
    client.post(f"/api/admin/banners/{paused['id']}/pause", headers=admin)
    assert [b["id"] for b in client.get("/api/banners").json()] == [live["id"]]  # scheduled and paused banners stay private

    client.get("/api/admin/gallery", headers=admin)  # staff open Gallery: its starting categories are there
    photo = {"imageUrl": "https://example.com/a.jpg", "categoryId": "gc-happy", "caption": "Bruno"}
    shown = client.post("/api/admin/gallery", json=photo, headers=admin).json()
    client.post("/api/admin/gallery", json={**photo, "categoryId": "gc-studio"}, headers=admin)  # stays hidden
    client.post("/api/admin/gallery/bulk", json={"action": "show", "ids": [shown["id"]]}, headers=admin)
    gallery = client.get("/api/gallery").json()
    assert [p["id"] for p in gallery["photos"]] == [shown["id"]] and gallery["categories"] == [{"id": "gc-happy", "name": "Happy pets"}]

    about = next(p for p in client.get("/api/admin/pages", headers=admin).json() if p["key"] == "about")
    sections = [{**s, "body": "DRAFT TEXT"} for s in about["sections"]]
    client.put("/api/admin/pages/about/draft", json={"sections": sections}, headers=admin)
    page = client.get("/api/pages/about").json()
    assert "DRAFT TEXT" not in str(page) and "Meet the groomers" not in str(page)  # no draft, no hidden section
    assert set(page) == {"key", "title", "sections"} and set(page["sections"][0]) == {"id", "heading", "body"}  # nor who published it
    assert client.get("/api/pages/nope").status_code == 404

    client.post("/api/admin/faqs", json={"groupId": "fg-booking", "question": "How do I book?", "answer": "Tap Book now."}, headers=admin)
    assert [f["question"] for f in client.get("/api/faqs").json()["faqs"]] == ["How do I book?"]
