"""Fills an empty development database with demo data: python -m app.seed

Only for your own Mac (it refuses unless the database is the local one). Real staff accounts are created at launch.
Each part is added only while its table is empty, so running it again is safe.
"""

from datetime import timedelta

from sqlalchemy import select

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.dates import today
from app.grooming.catalog.models import Service, Station
from app.grooming.offers.models import Offer
from app.grooming.plans.models import Plan
from app.shared.staff.models import StaffUser
from app.shared.staff.service import create_staff

# The same demo accounts as the admin's sign-in page (admin/src/app/core/mocks/mock-data.ts).
DEMO_PASSWORD = "pawsword"
DEMO_STAFF = [
    ("Sanjay R.", "owner@poshpaws.in", "super_admin"),
    ("Meera K.", "meera@poshpaws.in", "admin"),
    ("Amit J.", "amit@poshpaws.in", "staff"),
]

# The catalog uses the admin demo's ids too, so the demo bookings and memberships the admin still makes up
# (until those modules are built) find their service, station and plan here.
# (id, pet, name, category, rupees, minutes, description); the last one of each pet type is archived.
DEMO_SERVICES = [
    ("dog-signature-bath", "dog", "Signature Bath", "Bath", 1200, 45,
     "A deep cleanse using premium organic shampoos, blow-dry, and light fragrance. Leaves your pet fresh for days."),
    ("dog-full-groom-style", "dog", "Full Groom & Style", "Haircut", 2500, 90,
     "Bath, breed-specific haircut, nail trim, ear cleaning, and a finishing spritz. The complete experience."),
    ("dog-royal-package", "dog", "Royal Package", "Package", 4500, 150,
     "Our signature full groom plus de-shedding treatment, teeth brushing, and a paw massage. The ultimate indulgence."),
    ("dog-nail-trim-filing", "dog", "Nail Trim & Filing", "Add-on", 400, 20,
     "Precise nail clipping and filing to keep your pet comfortable and your furniture safe."),
    ("dog-de-shedding-treatment", "dog", "De-shedding Treatment", "Treatment", 1800, 60,
     "Specialised treatment to reduce shedding by up to 80%. Ideal for double-coat breeds during seasonal changes."),
    ("dog-flea-tick-spa", "dog", "Flea & Tick Spa", "Treatment", 1500, 60,
     "A medicated treatment bath that eliminates fleas and ticks using vet-approved, pet-safe solutions."),
    ("dog-teeth-cleaning", "dog", "Teeth Cleaning", "Add-on", 500, 20,
     "Gentle brushing with enzymatic pet toothpaste for fresher breath."),
    ("cat-gentle-cat-bath", "cat", "Gentle Cat Bath", "Bath", 900, 40,
     "A calm, stress-free bath using fragrance-free organic formulas — ideal even for cats that dislike water."),
    ("cat-full-groom-trim", "cat", "Full Groom & Trim", "Haircut", 2000, 75,
     "Breed-specific coat trim, nail clipping, ear cleaning, and a gentle blow-dry finish."),
    ("cat-nail-trim-filing", "cat", "Nail Trim & Filing", "Add-on", 350, 15,
     "Careful nail trimming to prevent overgrowth and scratching. Done by patient, cat-experienced groomers."),
    ("cat-de-shedding-treatment", "cat", "De-shedding Treatment", "Treatment", 1400, 50,
     "Reduces loose fur and hairballs with a deep-conditioning treatment. Great for long-haired breeds."),
    ("cat-royale-cat-package", "cat", "Royale Cat Package", "Package", 3500, 120,
     "The full experience — bath, trim, nail filing, ear cleaning, de-shed, and a calming paw massage."),
    ("cat-flea-tick-spa", "cat", "Flea & Tick Spa", "Treatment", 1200, 50,
     "Medicated, vet-approved treatment that safely eliminates fleas and ticks while being gentle on your cat."),
    ("cat-paw-balm", "cat", "Paw Balm Treatment", "Add-on", 300, 15,
     "Moisturising balm for dry, cracked paw pads."),
]
ARCHIVED = {"dog-teeth-cleaning", "cat-paw-balm"}

DEMO_STATIONS = [("st1", "Station 1", "all"), ("st2", "Station 2", "all"), ("st3", "Cat corner", "cats")]

BASIC_SERVICES = ["dog-signature-bath", "dog-nail-trim-filing", "cat-gentle-cat-bath", "cat-nail-trim-filing"]
POSH_SERVICES = BASIC_SERVICES + ["dog-full-groom-style", "dog-de-shedding-treatment", "cat-full-groom-trim", "cat-de-shedding-treatment"]
ROYAL_SERVICES = POSH_SERVICES + ["dog-flea-tick-spa", "dog-royal-package", "cat-flea-tick-spa", "cat-royale-cat-package"]


def _benefits(first: str, discount: str, *included: bool) -> list[dict]:
    """The six lines every plan card shows, and which of them this plan includes."""
    texts = [first, "WhatsApp reminders", "Pet profile & history", "Priority slot booking", discount, "Post-groom photos"]
    return [{"text": text, "included": yes} for text, yes in zip(texts, included)]


def _demo_plans() -> list[Plan]:
    return [
        Plan(id="basic", name="Basic", tagline="For the occasional grooming visit", price_paise=49900, billing="month",
             sessions_per_period=2, discount_percent=0, eligible_service_ids=BASIC_SERVICES, featured=False, sort_order=0,
             benefits=_benefits("2 grooming sessions", "Service discounts", True, True, True, False, False, False)),
        Plan(id="posh", name="Posh", tagline="For the devoted pet parent", price_paise=99900, billing="month",
             sessions_per_period=5, discount_percent=10, eligible_service_ids=POSH_SERVICES, featured=True, sort_order=1,
             benefits=_benefits("5 grooming sessions", "10% off all services", True, True, True, True, True, False)),
        Plan(id="royal", name="Royal", tagline="The ultimate pet pampering", price_paise=199900, billing="month",
             sessions_per_period=None, discount_percent=20, eligible_service_ids=ROYAL_SERVICES, featured=False, sort_order=2,
             benefits=_benefits("Unlimited sessions", "20% off all services", True, True, True, True, True, True)),
    ]


def _demo_offers() -> list[Offer]:
    t = today()

    def day(n: int):
        return t + timedelta(days=n)

    dog_ids = [s[0] for s in DEMO_SERVICES if s[1] == "dog" and s[0] not in ARCHIVED]
    cat_ids = [s[0] for s in DEMO_SERVICES if s[1] == "cat" and s[0] not in ARCHIVED]
    return [
        Offer(id="off-1", title="Diwali grooming week", discount_type="percent", value=20, code="DIWALI20", applies_to="some_services",
              service_ids=dog_ids, starts_on=day(-20), ends_on=day(2), total_uses=150, per_customer=1, used=84),
        Offer(id="off-2", title="Refer a friend", discount_type="flat", value=20000, code="FRIEND200", applies_to="all_services",
              starts_on=day(-200), ends_on=None, total_uses=None, per_customer=None, used=31),
        Offer(id="off-3", title="First groom, 15% off", discount_type="percent", value=15, code="FIRSTPAW15", applies_to="all_services",
              starts_on=day(1), ends_on=day(30), total_uses=200, per_customer=1, new_customers_only=True, used=0),
        Offer(id="off-4", title="Cat care month", discount_type="percent", value=10, code="MEOW10", applies_to="some_services",
              service_ids=cat_ids, starts_on=day(-60), ends_on=day(-31), total_uses=100, per_customer=1, used=57),
        Offer(id="off-5", title="Royal plan, first month", discount_type="flat", value=50000, code="ROYAL500", applies_to="plans",
              starts_on=day(-30), ends_on=day(30), total_uses=50, per_customer=1, used=12, paused=True),
    ]


def _empty(db, model) -> bool:
    return db.scalar(select(model).limit(1)) is None


def seed() -> None:
    if "localhost" not in settings.database_url and "127.0.0.1" not in settings.database_url:
        raise SystemExit("Seeding is only for the local development database.")
    with SessionLocal() as db:
        if _empty(db, StaffUser):
            for name, email, role in DEMO_STAFF:
                create_staff(db, name, email, role, DEMO_PASSWORD)
            db.add(StaffUser(name="Pooja S.", email="pooja@poshpaws.in", role="staff", status="invited"))
            print(f"Added {len(DEMO_STAFF)} demo staff (password {DEMO_PASSWORD!r}) and 1 invited.")
        if _empty(db, Service):
            positions = {"dog": 0, "cat": 0}
            for sid, pet, name, category, rupees, minutes, description in DEMO_SERVICES:
                db.add(Service(id=sid, pet_type=pet, name=name, category=category, price_paise=rupees * 100, duration_minutes=minutes,
                               description=description, visible=sid not in ARCHIVED, archived=sid in ARCHIVED, sort_order=positions[pet]))
                positions[pet] += 1
            print(f"Added {len(DEMO_SERVICES)} services.")
        if _empty(db, Station):
            for i, (sid, name, can_do) in enumerate(DEMO_STATIONS):
                db.add(Station(id=sid, name=name, active=True, can_do=can_do, service_ids=[], sort_order=i))
            print(f"Added {len(DEMO_STATIONS)} stations.")
        if _empty(db, Plan):
            db.add_all(_demo_plans())
            print("Added 3 membership plans.")
        if _empty(db, Offer):
            db.add_all(_demo_offers())
            print("Added 5 offers.")
        db.commit()
        print("Demo data is ready.")


if __name__ == "__main__":
    seed()
