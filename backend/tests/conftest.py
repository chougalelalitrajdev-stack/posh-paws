"""pytest reads this first. Tests use their own database, so they never touch the development data."""

import os

os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://localhost:5432/posh_paws_test")

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

import app.shared.settings.models  # noqa: E402,F401  (registers the tables)
import app.shared.staff.models  # noqa: E402,F401
import app.shared.templates.models  # noqa: E402,F401
from app.core.database import Base, SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def tables():
    """Fresh tables once per test run, built straight from the models."""
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    yield


@pytest.fixture(autouse=True)
def empty_tables():
    """Every test starts with empty tables."""
    yield
    with SessionLocal() as db:
        for table in reversed(Base.metadata.sorted_tables):
            db.execute(table.delete())
        db.commit()


@pytest.fixture
def db() -> Session:
    with SessionLocal() as session:
        yield session


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture
def signed_in(client, db):
    """Headers for a signed-in owner, admin or staff member: signed_in("admin")."""
    from app.shared.staff.service import create_staff

    people = {"super_admin": ("Sanjay R.", "owner@poshpaws.in"), "admin": ("Meera K.", "meera@poshpaws.in"), "staff": ("Amit J.", "amit@poshpaws.in")}
    for role, (name, email) in people.items():
        create_staff(db, name, email, role, "pawsword")

    def headers(role: str) -> dict:
        token = client.post("/api/admin/auth/login", json={"email": people[role][1], "password": "pawsword"}).json()["token"]
        return {"Authorization": f"Bearer {token}"}

    return headers
