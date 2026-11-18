"""pytest reads this first. Tests use their own database, so they never touch the development data."""

import os

os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://localhost:5432/posh_paws_test")

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

import app.shared.staff.models  # noqa: E402,F401  (registers the tables)
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
