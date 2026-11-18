"""Fills an empty development database with demo data (staff, catalog, customers and pets): python -m app.seed

Only for your own Mac (it refuses unless the database is the local one). Real staff accounts are created at launch.
Each part is added only while its table is empty, so running it again is safe.
"""

from datetime import date, timedelta

from sqlalchemy import select

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.dates import now, today
from app.grooming.catalog.models import Service, Station
from app.grooming.offers.models import Offer
from app.grooming.plans.models import Plan
from app.shared.customers.models import Customer, Pet
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


# (id, name, phone, customer for this many days, email, area) and their pets (id, name, type, breed, born, gender, kg, coat,
# temperament, vaccination, notes, health notes), as in the admin's demo.
DEMO_CUSTOMERS = [
    ("c1", "Ananya Desai", "9822041763", 970, "ananya.desai@example.com", "Viman Nagar, Pune", [
        ("p1", "Coco", "dog", "Shih Tzu", "2022-06-01", "female", 6, "Small · long", "Anxious", "up_to_date",
         "Anxious with hair dryers; towel-dry first and keep the room quiet.", "No known allergies."),
        ("p2", "Pepper", "dog", "Indie", "2024-04-10", "male", 14, "Medium · short", "Playful", "due_soon",
         "Loves treats; wriggles during nail trims.", "Rabies booster due soon."),
    ]),
    ("c2", "Priya Sharma", "9876543210", 730, "priya.s@example.com", "Koregaon Park, Pune", [
        ("p3", "Bruno", "dog", "Golden Retriever", "2023-02-14", "male", 31, "Large · double", "Calm, friendly", "up_to_date",
         "Royal Package regular. Likes the paw massage.", "Mild skin sensitivity, use oatmeal shampoo."),
    ]),
    ("c3", "Rohan Mehta", "9765430981", 650, None, "Baner, Pune", [
        ("p4", "Luna", "cat", "Persian", "2024-01-05", "female", 4, "Small · long", "Calm, shy with strangers", "up_to_date",
         "Sensitive ears. Calm, but shy with strangers; let her settle before drying.", None),
    ]),
    ("c4", "Neha Kulkarni", "9850766124", 480, None, None, [
        ("p5", "Tiger", "dog", "Indie", "2021-09-01", "male", None, "Medium · short", None, "unknown", None, None),
    ]),
    ("c5", "Aditi Nair", "9923450876", 440, None, "Kalyani Nagar, Pune", [
        ("p6", "Mia", "cat", "Siamese", "2020-05-01", "female", 3.5, "Small · short", "Vocal", "up_to_date",
         "Hisses at first, settles in five minutes.", "On a kidney-care diet."),
    ]),
    ("c6", "Sameer Khan", "9881230457", 850, "sameer.k@example.com", None, [
        ("p7", "Rocky", "dog", "German Shepherd", "2019-03-01", "male", 36, "Large · double", "Calm", "up_to_date",
         "Needs help on and off the table (hips).", "Mild hip dysplasia."),
        ("p8", "Kaju", "dog", "Pug", "2023-12-01", "male", None, "Small · short", None, "up_to_date", None, None),
    ]),
    ("c7", "Karan Joshi", "9890411220", 136, None, None, [
        ("p9", "Max", "dog", "Beagle", "2025-06-01", "male", 10, "Medium · short", "Playful", "not_vaccinated",
         "First groom was a while ago.", "Puppy vaccinations pending, ask before booking."),
    ]),
    ("c8", "Isha Patil", "9730018862", 600, None, None, [("p10", "Bella", "dog", "Pomeranian", "2022-01-01", "female", None, "Small · double", None, "up_to_date", None, None)]),
    ("c9", "Arjun Mehta", "9822177310", 630, None, None, [("p11", "Oreo", "cat", "Maine Coon", "2023-04-01", "male", None, "Large · long", None, "up_to_date", "Mats behind the ears.", None)]),
    ("c10", "Vikram Rao", "9970122845", 540, None, None, [("p12", "Leo", "dog", "Labrador", "2022-08-01", "male", None, "Large · short", None, "up_to_date", None, None)]),
    ("c11", "Farah Shaikh", "9890155532", 270, None, "Wanowrie, Pune", [("p13", "Mochi", "cat", "Persian", "2024-02-01", "female", None, "Long", None, "up_to_date", None, None)]),
    ("c12", "Dev Malhotra", "9819044781", 11, None, None, [("p14", "Bolt", "dog", "Indie", "2024-07-01", "male", None, "Medium · short", None, "unknown", None, None)]),
    ("c13", "Kavya Iyer", "9867011223", 715, None, None, [("p15", "Pumpkin", "cat", "Ragdoll", "2022-10-01", "female", None, "Long", None, "up_to_date", None, None)]),
    ("c14", "Meghna Rao", "9833022110", 545, None, None, [("p16", "Zoe", "dog", "Shih Tzu", "2023-03-01", "female", None, "Small · long", None, "up_to_date", None, None)]),
    ("c15", "Rahul Verma", "9920033441", 700, None, None, [("p17", "Simba", "dog", "Labrador", "2021-01-01", "male", None, "Large · short", None, "up_to_date", None, None)]),
    ("c16", "Sneha Joshi", "9819900112", 437, None, None, [("p18", "Daisy", "dog", "Beagle", "2023-05-01", "female", None, "Medium · short", None, "up_to_date", None, None)]),
    ("c17", "Nisha Kapoor", "9811177665", 3, None, None, [("p19", "Sheru", "dog", "Indie", None, "male", None, None, None, "unknown", None, None)]),
]


def _demo_customers() -> list[Customer]:
    customers = []
    for cid, name, phone, days, email, area, pets in DEMO_CUSTOMERS:
        since = now() - timedelta(days=days)
        c = Customer(id=cid, name=name, phone=phone, email=email, area=area, customer_since=since, pets=[
            Pet(id=pid, name=pname, type=kind, breed=breed, birth_date=date.fromisoformat(born) if born else None, gender=gender,
                weight_kg=kg, coat=coat, temperament=temperament, vaccination=vaccination, notes=notes, health_notes=health,
                created_at=since + timedelta(minutes=i))  # in the order they were added
            for i, (pid, pname, kind, breed, born, gender, kg, coat, temperament, vaccination, notes, health) in enumerate(pets)
        ])
        customers.append(c)
    customers[0].note_text = "Prefers evening slots and WhatsApp over calls. Coco gets anxious with dryers; towel-dry first."
    customers[0].note_by, customers[0].note_at = "Meera K.", now() - timedelta(days=29)
    return customers


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
        if _empty(db, Customer):
            db.add_all(_demo_customers())
            print(f"Added {len(DEMO_CUSTOMERS)} customers and their pets.")
        if _empty(db, Offer):
            db.add_all(_demo_offers())
            print("Added 5 offers.")
        db.commit()
        print("Demo data is ready.")


if __name__ == "__main__":
    seed()
