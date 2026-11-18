"""Fills an empty development database with demo data: python -m app.seed

Only for your own Mac (it refuses unless the database is the local one). Real staff accounts are created at launch.
"""

from sqlalchemy import select

from app.core.config import settings
from app.core.database import SessionLocal
from app.shared.staff.models import StaffUser
from app.shared.staff.service import create_staff

# The same demo accounts as the admin's sign-in page (admin/src/app/core/mocks/mock-data.ts).
DEMO_PASSWORD = "pawsword"
DEMO_STAFF = [
    ("Sanjay R.", "owner@poshpaws.in", "super_admin"),
    ("Meera K.", "meera@poshpaws.in", "admin"),
    ("Amit J.", "amit@poshpaws.in", "staff"),
]


def seed() -> None:
    if "localhost" not in settings.database_url and "127.0.0.1" not in settings.database_url:
        raise SystemExit("Seeding is only for the local development database.")
    with SessionLocal() as db:
        if db.scalar(select(StaffUser.id).limit(1)):
            print("Staff already there; nothing to do.")
            return
        for name, email, role in DEMO_STAFF:
            create_staff(db, name, email, role, DEMO_PASSWORD)
        db.add(StaffUser(name="Pooja S.", email="pooja@poshpaws.in", role="staff", status="invited"))
        db.commit()
        print(f"Added {len(DEMO_STAFF)} demo staff (password {DEMO_PASSWORD!r}) and 1 invited.")


if __name__ == "__main__":
    seed()
