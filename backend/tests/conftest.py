"""pytest reads this first. Tests use their own database, so they never touch the development data."""

import os
import tempfile

os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://localhost:5432/posh_paws_test")
os.environ.setdefault("UPLOAD_DIR", tempfile.mkdtemp(prefix="posh-paws-test-uploads-"))  # test photos go to a throwaway folder

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import text  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

import app.core.rate_limit  # noqa: E402,F401
import app.grooming.bookings.models  # noqa: E402,F401  (registers the tables)
import app.grooming.catalog.models  # noqa: E402,F401
import app.grooming.offers.models  # noqa: E402,F401
import app.grooming.pet_pricing.models  # noqa: E402,F401
import app.grooming.plans.models  # noqa: E402,F401
import app.grooming.slots.models  # noqa: E402,F401
import app.grooming.subscriptions.models  # noqa: E402,F401
import app.shared.content.models  # noqa: E402,F401
import app.shared.customer_login.models  # noqa: E402,F401
import app.shared.customers.models  # noqa: E402,F401
import app.shared.payments.models  # noqa: E402,F401
import app.shared.settings.models  # noqa: E402,F401
import app.shared.staff.models  # noqa: E402,F401
import app.shared.templates.models  # noqa: E402,F401
from app.core.database import Base, SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def tables():
    """Fresh tables once per test run, built straight from the models."""
    with engine.begin() as conn:
        conn.execute(text("create extension if not exists btree_gist"))  # for the no-double-booking rule (as in the migration)
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
