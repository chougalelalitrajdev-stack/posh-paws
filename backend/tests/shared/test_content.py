"""Photo uploads and the customer app's content: banners, gallery, pages (draft → publish) and FAQs."""

from datetime import timedelta
from pathlib import Path

from app.core.config import settings
from app.core.dates import today

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64  # the start of a PNG file is enough to recognise it


def test_photo_uploads_are_checked_and_stored(client, signed_in):
    admin, staff = signed_in("admin"), signed_in("staff")

    def send(data, name="photo.jpg", headers=admin):
        return client.post("/api/admin/uploads", files={"file": (name, data, "image/jpeg")}, headers=headers)

    assert send(PNG, headers=staff).status_code == 403  # Admins edit content
    url = send(PNG).json()["url"]
    assert url.startswith(f"{settings.public_url}/uploads/") and url.endswith(".png")  # the real type, whatever the name says
    name = url.rsplit("/", 1)[1]
    assert (Path(settings.upload_dir) / name).read_bytes() == PNG
    assert client.get(f"/uploads/{name}").content == PNG  # the apps load it from here

    assert send(b"not a photo").json()["detail"] == "Use a JPG, PNG or WebP image."
    assert send(b"").json()["detail"] == "Choose an image."
    assert send(PNG + b"\x00" * (10 * 1024 * 1024)).json()["detail"] == "That image is over 10 MB. Pick a smaller one."


def test_banners(client, signed_in):
    admin, staff = signed_in("admin"), signed_in("staff")
    t = today()
    hero = {"placement": "home_hero", "title": "Diwali week", "subtitle": "20% off", "buttonText": "Book now", "link": "book", "startsOn": str(t)}
    assert client.post("/api/admin/banners", json=hero, headers=staff).status_code == 403
    first = client.post("/api/admin/banners", json=hero, headers=admin).json()
    second = client.post("/api/admin/banners", json={**hero, "title": "Winter coats", "startsOn": str(t + timedelta(days=3))}, headers=admin).json()
    old = client.post("/api/admin/banners", json={**hero, "title": "Monsoon", "startsOn": str(t - timedelta(days=60)), "endsOn": str(t - timedelta(days=1))},
                      headers=admin).json()
    assert (first["status"], second["status"], old["status"]) == ("live", "scheduled", "ended")
    assert first["imageUrl"] is None and first["paused"] is False

    listed = client.put("/api/admin/banners/order", json={"placement": "home_hero", "ids": [second["id"], first["id"], old["id"]]}, headers=admin).json()
    assert [b["title"] for b in listed] == ["Winter coats", "Diwali week", "Monsoon"]
    assert client.put("/api/admin/banners/order", json={"placement": "home_hero", "ids": [first["id"]]}, headers=admin).json()["detail"] == \
        "The list changed. Reload and try again."
    assert client.post(f"/api/admin/banners/{first['id']}/pause", headers=admin).json()["status"] == "paused"
    assert client.post(f"/api/admin/banners/{first['id']}/resume", headers=admin).json()["status"] == "live"

    def detail(**change):
        return client.post("/api/admin/banners", json={**hero, **change}, headers=admin).json()["detail"]

    assert detail(title=" ") == "Enter a title."
    assert detail(title="x" * 49) == "Keep the title to 48 characters."
    assert detail(placement="footer") == "Pick where the banner shows."
    assert detail(link="shop") == "Pick the page the button opens."
    assert detail(buttonText="") == "Enter the button text."
    assert detail(endsOn=str(t - timedelta(days=1))) == "The end date is before the start date."

    content = client.get("/api/admin/dashboard", headers=staff).json()["content"]
    assert content == [{"title": "Diwali week", "where": "Home hero banner", "status": "Live", "tone": "success"}]  # the first live hero
    assert client.delete(f"/api/admin/banners/{old['id']}", headers=admin).status_code == 204
    assert len(client.get("/api/admin/banners", headers=staff).json()) == 2


def test_gallery(client, signed_in):
    admin, staff = signed_in("admin"), signed_in("staff")
    start = client.get("/api/admin/gallery", headers=staff).json()
    assert [c["name"] for c in start["categories"]] == ["Grooming", "Before & after", "Happy pets", "Studio", "Events"] and start["photos"] == []

    def add(caption=""):
        return client.post("/api/admin/gallery", json={"imageUrl": "http://localhost:8000/uploads/a.jpg", "categoryId": "gc-happy", "caption": caption},
                           headers=admin).json()

    bruno, luna = add("Bruno after his bath"), add()
    assert bruno["visible"] is False  # new photos start hidden
    photos = client.get("/api/admin/gallery", headers=staff).json()["photos"]
    assert [p["id"] for p in photos] == [luna["id"], bruno["id"]]  # the newest first

    def bulk(**body):
        return client.post("/api/admin/gallery/bulk", json=body, headers=admin).json()

    assert bulk(action="show", ids=[bruno["id"], luna["id"]])["detail"] == "Add a caption to each photo before showing it in the app."
    edit = {"caption": "", "categoryId": "gc-grooming", "pet": "Persian", "visible": True}
    assert client.put(f"/api/admin/gallery/{luna['id']}", json=edit, headers=admin).json()["detail"] == "Add a caption before showing the photo in the app."
    shown = client.put(f"/api/admin/gallery/{luna['id']}", json={**edit, "caption": "Luna, freshly brushed"}, headers=admin).json()
    assert (shown["visible"], shown["categoryId"], shown["pet"]) == (True, "gc-grooming", "Persian")
    moved = bulk(action="move", ids=[bruno["id"]], categoryId="gc-studio")
    assert {c["id"]: c["photoCount"] for c in moved["categories"]}["gc-studio"] == 1
    ordered = client.put("/api/admin/gallery/order", json={"ids": [bruno["id"], luna["id"]]}, headers=admin).json()
    assert [p["id"] for p in ordered["photos"]] == [bruno["id"], luna["id"]]

    cats = [{"id": c["id"], "name": c["name"]} for c in ordered["categories"]]

    def categories(listed):
        return client.put("/api/admin/gallery/categories", json={"categories": listed}, headers=admin).json()

    assert categories([c for c in cats if c["id"] != "gc-studio"])["detail"] == "Move the 1 photo in Studio to another category first."
    assert categories([*cats, {"name": "grooming"}])["detail"] == "Two categories have the same name."
    renamed = categories([{**c, "name": "Spa" if c["id"] == "gc-events" else c["name"]} for c in cats if c["id"] != "gc-before-after"] + [{"name": "Puppies"}])
    assert [c["name"] for c in renamed["categories"]] == ["Grooming", "Happy pets", "Studio", "Spa", "Puppies"]
    assert bulk(action="delete", ids=[bruno["id"]])["photos"] == [shown]


def test_pages_and_faqs(client, signed_in):
    admin, staff = signed_in("admin"), signed_in("staff")
    pages = client.get("/api/admin/pages", headers=staff).json()
    assert [p["key"] for p in pages] == ["home", "about", "terms", "privacy"]
    about = next(p for p in pages if p["key"] == "about")
    team = next(s for s in about["sections"] if s["kind"] == "Team")
    assert team["visible"] is False and about["draft"] is None

    url = "/api/admin/pages/about"
    without_team = [s for s in about["sections"] if s["kind"] != "Team"]
    assert client.put(f"{url}/draft", json={"sections": without_team}, headers=admin).json()["detail"] == "The Team section is part of the page. Hide it instead."
    sections = [{**s, "visible": True, "body": " Ask for your favourite groomer. "} if s["kind"] == "Team" else s for s in about["sections"]]
    draft = client.put(f"{url}/draft", json={"sections": [*sections, {"heading": "Parking", "body": "Free parking at the back."}]}, headers=admin).json()
    assert draft["draftSavedBy"] == "Meera K." and draft["draft"][2]["body"] == "Ask for your favourite groomer." and draft["draft"][3]["kind"] == "Text"
    assert draft["sections"] == about["sections"]  # customers still see the published words
    published = client.post(f"{url}/publish", headers=admin).json()
    assert (published["draft"], published["publishedBy"], len(published["sections"])) == (None, "Meera K.", 4)
    assert client.post(f"{url}/publish", headers=admin).json()["detail"] == "There are no draft changes to publish."
    today = client.get("/api/admin/dashboard", headers=staff).json()  # Today's content list has no draft left behind
    assert [row for row in today["content"] if row["status"] == "Draft"] == []

    data = client.get("/api/admin/faqs", headers=staff).json()
    assert [g["name"] for g in data["groups"]] == ["Booking", "Membership", "Pets and safety"] and data["faqs"] == []

    def ask(question, group="fg-booking"):
        return client.post("/api/admin/faqs", json={"groupId": group, "question": question, "answer": "Yes."}, headers=admin).json()

    one, two, pets = ask("How do I book?"), ask("Can I reschedule?"), ask("Is my pet safe?", "fg-pets")
    assert [f["question"] for f in client.put("/api/admin/faqs/order", json={"groupId": "fg-booking", "ids": [two["id"], one["id"]]}, headers=admin)
            .json()["faqs"]] == ["Can I reschedule?", "How do I book?", "Is my pet safe?"]
    moved = client.put(f"/api/admin/faqs/{two['id']}", json={"groupId": "fg-pets", "question": "Can I reschedule?", "answer": "Yes, 24 h before."}, headers=admin)
    assert moved.json()["groupId"] == "fg-pets"
    assert [f["id"] for f in client.get("/api/admin/faqs", headers=staff).json()["faqs"]] == [one["id"], pets["id"], two["id"]]  # last in its new group
    assert ask(" ")["detail"] == "Enter the question."
    assert client.post("/api/admin/faqs", json={"groupId": "nope", "question": "Q?", "answer": "A."}, headers=admin).json()["detail"] == "Pick a group."
    assert client.delete(f"/api/admin/faqs/{one['id']}", headers=admin).status_code == 204
