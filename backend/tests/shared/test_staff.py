"""Sign-in, tokens, roles and the team rules (Settings › Team & roles)."""

import base64
import json

import pytest

from app.core.security import hash_password, verify_password
from app.shared.staff.models import StaffUser
from app.shared.staff.service import create_staff

PASSWORD = "pawsword"


@pytest.fixture
def team(db):
    create_staff(db, "Sanjay R.", "owner@poshpaws.in", "super_admin", PASSWORD)
    create_staff(db, "Meera K.", "meera@poshpaws.in", "admin", PASSWORD)
    create_staff(db, "Amit J.", "amit@poshpaws.in", "staff", PASSWORD)


def sign_in(client, email, password=PASSWORD):
    return client.post("/api/admin/auth/login", json={"email": email, "password": password})


def auth(client, email):
    return {"Authorization": f"Bearer {sign_in(client, email).json()['token']}"}


def test_passwords_are_stored_as_salted_hashes():
    first, second = hash_password(PASSWORD), hash_password(PASSWORD)
    assert first != second and PASSWORD not in first  # same password, different fingerprints
    assert verify_password(PASSWORD, first)
    assert not verify_password("Pawsword", first)


def test_sign_in_gives_the_account_and_a_token(client, team):
    response = sign_in(client, "  Meera@PoshPaws.in ")
    assert response.status_code == 200
    body = response.json()
    assert {k: body["user"][k] for k in ("name", "email", "role")} == {"name": "Meera K.", "email": "meera@poshpaws.in", "role": "admin"}
    assert body["token"].count(".") == 2  # a JWT: header.claims.signature


def test_wrong_password_and_unknown_email_get_the_same_answer(client, team):
    wrong = sign_in(client, "meera@poshpaws.in", "nope")
    unknown = sign_in(client, "nobody@poshpaws.in")
    assert wrong.status_code == unknown.status_code == 401
    assert wrong.json() == unknown.json()


def test_invited_people_cannot_sign_in_yet(client, db, team):
    db.add(StaffUser(name="Pooja S.", email="pooja@poshpaws.in", role="staff", status="invited"))
    db.commit()
    assert sign_in(client, "pooja@poshpaws.in").status_code == 401


def test_the_token_proves_who_is_asking(client, team):
    assert client.get("/api/admin/team").status_code == 401  # no token
    assert client.get("/api/admin/team", headers={"Authorization": "Bearer made-up"}).status_code == 401

    # Amit edits his own token to say Super Admin: the signature no longer matches, so it's refused.
    header, claims, signature = sign_in(client, "amit@poshpaws.in").json()["token"].split(".")
    data = json.loads(base64.urlsafe_b64decode(claims + "=" * (-len(claims) % 4)))
    forged = base64.urlsafe_b64encode(json.dumps({**data, "role": "super_admin"}).encode()).decode().rstrip("=")
    assert client.get("/api/admin/team", headers={"Authorization": f"Bearer {header}.{forged}.{signature}"}).status_code == 401

    assert client.get("/api/admin/team", headers=auth(client, "amit@poshpaws.in")).status_code == 403  # Staff
    assert client.get("/api/admin/team", headers=auth(client, "meera@poshpaws.in")).status_code == 403  # Admin
    owner = client.get("/api/admin/team", headers=auth(client, "owner@poshpaws.in"))
    assert owner.status_code == 200
    assert [m["name"] for m in owner.json()] == ["Sanjay R.", "Meera K.", "Amit J."]


def test_team_rules(client, team):
    me = sign_in(client, "owner@poshpaws.in").json()
    h = {"Authorization": f"Bearer {me['token']}"}

    invited = client.post("/api/admin/team", json={"name": "Pooja S.", "email": "Pooja@PoshPaws.in", "role": "staff"}, headers=h)
    assert invited.status_code == 200
    assert invited.json() | {"id": None} == {"id": None, "name": "Pooja S.", "email": "pooja@poshpaws.in", "role": "staff", "status": "invited", "lastSeenAt": None}
    assert client.post("/api/admin/team", json={"name": "Again", "email": "pooja@poshpaws.in", "role": "staff"}, headers=h).status_code == 409
    bad = client.post("/api/admin/team", json={"name": "X", "email": "not-an-email", "role": "staff"}, headers=h)
    assert bad.status_code == 422 and bad.json() == {"detail": "Enter their email."}
    assert client.post("/api/admin/team", json={"name": "X", "email": "x@poshpaws.in", "role": "boss"}, headers=h).status_code == 422

    members = {m["name"]: m["id"] for m in client.get("/api/admin/team", headers=h).json()}
    assert client.put(f"/api/admin/team/{me['user']['id']}", json={"role": "staff"}, headers=h).status_code == 409  # own role
    promoted = client.put(f"/api/admin/team/{members['Meera K.']}", json={"role": "super_admin"}, headers=h)
    assert promoted.json()["role"] == "super_admin"

    assert client.delete(f"/api/admin/team/{me['user']['id']}", headers=h).status_code == 409  # yourself
    assert client.delete(f"/api/admin/team/{members['Pooja S.']}", headers=h).status_code == 204
    assert "Pooja S." not in [m["name"] for m in client.get("/api/admin/team", headers=h).json()]
