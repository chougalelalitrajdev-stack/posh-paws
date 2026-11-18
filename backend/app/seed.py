"""Fills an empty development database with demo data (staff, catalog, customers and pets, memberships, bookings and payments, content): python -m app.seed

Only for your own Mac (it refuses unless the database is the local one). Real staff accounts are created at launch.
Each part is added only while its table is empty, so running it again is safe.
"""

from datetime import date, datetime, timedelta, timezone
from urllib.parse import quote

from sqlalchemy import select, text
from sqlalchemy.dialects.postgresql import Range

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.dates import local, now, starts_at, today
from app.grooming.bookings.models import Booking, BookingActivity
from app.grooming.bookings.service import settle
from app.grooming.catalog.models import Service, Station
from app.grooming.offers.models import Offer
from app.grooming.plans.models import Plan
from app.grooming.subscriptions.models import PlanChange, Subscription
from app.shared.content.models import Banner, Faq, GalleryPhoto, SitePage
from app.shared.content.service import faq_data, gallery, list_pages
from app.shared.customers.models import Customer, Pet
from app.shared.payments.models import Payment, PaymentLink
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


# Memberships, as in the admin's demo: (id, customer, plan, started days ago, status, sessions used, renews in days, ended days ago,
# upgraded from (plan, days ago), downgrade waiting for renewal).
DEMO_SUBSCRIPTIONS = [
    ("SUB-101", "c1", "posh", 970, "active", 2, 4, None, None, None),
    ("SUB-102", "c2", "royal", 650, "active", 3, 12, None, None, "posh"),
    ("SUB-103", "c6", "posh", 480, "active", 4, 1, None, None, None),
    ("SUB-104", "c5", "basic", 435, "active", 1, 20, None, None, None),
    ("SUB-105", "c13", "basic", 700, "active", 0, 11, None, None, None),
    ("SUB-106", "c15", "posh", 690, "active", 1, 9, None, ("basic", 3), None),
    ("SUB-107", "c11", "posh", 270, "active", 5, 2, None, None, None),
    ("SUB-108", "c8", "basic", 6, "payment_pending", 0, None, None, None, None),
    ("SUB-109", "c10", "royal", 540, "expired", 0, None, 22, None, None),
    ("SUB-110", "c12", "basic", 210, "cancelled", 0, None, 16, None, None),
]

# Bookings: (id, customer, pet, service, stage, money, created minutes ago, day from today, time, station, link asks for, link sent
# minutes ago, source). money: what happened to the payment (paid, link_sent, failed, refunded, or None).
DEMO_BOOKINGS = [
    # Phone calls: one left unfinished, and links waiting to be paid
    ("PP-1049", "c7", "p9", "dog-signature-bath", "draft", None, 60 * 16, None, None, None, None, None, "phone"),
    ("PP-1048", "c3", "p4", "cat-royale-cat-package", "awaiting_payment", "link_sent", 60 * 8, 2, "12:00", "st2", "full", 60 * 7, "phone"),
    ("PP-1047", "c4", "p5", "dog-full-groom-style", "awaiting_payment", "failed", 90, 2, "15:00", "st1", "full", 60, "phone"),
    ("PP-1046", "c14", "p16", "dog-nail-trim-filing", "awaiting_payment", "link_sent", 60 * 26, 0, "12:00", "st2", "full", 60 * 25, "phone"),
    # Today
    ("PP-1040", "c6", "p7", "dog-full-groom-style", "completed", "paid", 60 * 24 * 3, 0, "09:30", "st1", "full", 60 * 24 * 3, "app"),
    ("PP-1039", "c13", "p15", "cat-gentle-cat-bath", "completed", "paid", 60 * 24 * 2, 0, "10:00", "st2", "full", 60 * 24 * 2, "app"),
    ("PP-1045", "c2", "p3", "dog-royal-package", "confirmed", "paid", 60 * 24 * 2, 0, "11:30", "st1", "full", 60 * 24 * 2 - 30, "app"),
    ("PP-1038", "c15", "p17", "dog-de-shedding-treatment", "confirmed", "paid", 60 * 24 * 4, 0, "15:00", "st1", "hold", 60 * 24 * 4, "app"),
    ("PP-1037", "c5", "p6", "cat-flea-tick-spa", "confirmed", "paid", 60 * 24 * 3, 0, "16:30", "st2", "full", 60 * 24 * 3, "app"),
    ("PP-1036", "c16", "p18", "dog-signature-bath", "confirmed", "paid", 60 * 24 * 5, 0, "17:00", "st1", "hold", 60 * 24 * 5, "app"),
    # Coming days (PP-1035 was booked by phone: confirmed with no advance, everything to pay at the shop)
    ("PP-1035", "c6", "p8", "dog-signature-bath", "confirmed", None, 60 * 24, 1, "10:00", "st1", None, None, "phone"),
    ("PP-1034", "c1", "p2", "dog-nail-trim-filing", "confirmed", "paid", 60 * 30, 3, "11:00", "st2", "hold", 60 * 29, "app"),
    ("PP-1033", "c2", "p3", "dog-de-shedding-treatment", "confirmed", "paid", 60 * 40, 4, "16:00", "st1", "full", 60 * 39, "app"),
    # Earlier
    ("PP-1032", "c8", "p10", "dog-nail-trim-filing", "no_show", "paid", 60 * 24 * 6, -2, "17:00", "st1", "hold", 60 * 24 * 6, "app"),
    ("PP-1031", "c9", "p11", "cat-gentle-cat-bath", "cancelled", "refunded", 60 * 24 * 7, -3, "11:00", "st2", "full", 60 * 24 * 7, "app"),
]
# Completed, paid visits over the last six days (the Today chart), and two customers not seen in 90+ days: (day, customer, pet, service, time, station).
DEMO_HISTORY = [
    (-1, "c2", "p3", "dog-royal-package", "10:00", "st1"), (-1, "c5", "p6", "cat-gentle-cat-bath", "11:00", "st2"), (-1, "c13", "p15", "cat-full-groom-trim", "15:00", "st2"),
    (-2, "c6", "p8", "dog-full-groom-style", "09:30", "st1"), (-2, "c16", "p18", "dog-signature-bath", "12:00", "st2"),
    (-3, "c1", "p1", "dog-full-groom-style", "10:00", "st1"), (-3, "c15", "p17", "dog-royal-package", "15:00", "st1"), (-3, "c3", "p4", "cat-gentle-cat-bath", "16:30", "st2"),
    (-3, "c14", "p16", "dog-signature-bath", "11:00", "st2"),
    (-4, "c2", "p3", "dog-de-shedding-treatment", "09:00", "st1"), (-4, "c6", "p7", "dog-royal-package", "11:00", "st2"), (-4, "c11", "p13", "cat-full-groom-trim", "15:30", "st2"),
    (-4, "c14", "p16", "dog-flea-tick-spa", "17:00", "st1"),
    (-5, "c8", "p10", "dog-full-groom-style", "10:30", "st1"), (-5, "c5", "p6", "cat-de-shedding-treatment", "12:00", "st2"), (-5, "c1", "p2", "dog-signature-bath", "16:00", "st1"),
    (-6, "c10", "p12", "dog-signature-bath", "10:00", "st1"), (-6, "c13", "p15", "cat-gentle-cat-bath", "14:30", "st2"),
    (-135, "c7", "p9", "dog-signature-bath", "11:00", "st1"), (-123, "c9", "p11", "cat-gentle-cat-bath", "12:00", "st2"),
]
HOLD_PAISE, BUFFER_MINUTES = 10_000, 15


def _demo_subscriptions(plans: dict[str, Plan]) -> list[Subscription]:
    t, moment = today(), datetime.now(timezone.utc)
    subs = []
    for sid, customer, plan_key, started, status, used, renews_in, ended, upgraded, downgrade in DEMO_SUBSCRIPTIONS:
        plan = plans[plan_key]
        s = Subscription(id=sid, customer_id=customer, plan_id=plan.id, plan_name=plan.name, price_paise=plan.price_paise, status=status,
                         sessions_total=plan.sessions_per_period, sessions_used=used, started_on=t - timedelta(days=started),
                         renews_on=t + timedelta(days=renews_in) if renews_in is not None else None,
                         ended_on=t - timedelta(days=ended) if ended is not None else None, next_plan_id=plans[downgrade].id if downgrade else None)
        if s.renews_on:
            # The last two monthly payments (oldest first).
            for months_ago in (2, 1):
                paid_on = s.renews_on - timedelta(days=30 * months_ago)
                if paid_on >= s.started_on:
                    s.payments.append(Payment(id=f"PAY-{sid}-{len(s.payments) + 1}", customer_id=customer, kind="plan", amount_paise=plan.price_paise,
                                              method="online", at=starts_at(paid_on, "10:00")))
        if upgraded:
            from_plan, days_ago = plans[upgraded[0]], upgraded[1]
            at = moment - timedelta(days=days_ago)
            difference = plan.price_paise - from_plan.price_paise
            s.changes.append(PlanChange(kind="upgrade", from_plan=from_plan.name, to_plan=plan.name, paid_paise=difference, method="upi_qr", by="Meera K.", at=at))
            s.payments.append(Payment(id=f"PAY-{sid}-{len(s.payments) + 1}", customer_id=customer, kind="upgrade", amount_paise=difference,
                                      method="upi_qr", by="Meera K.", at=at))
        if downgrade:
            s.changes.append(PlanChange(kind="downgrade", from_plan=plan.name, to_plan=plans[downgrade].name, by="Meera K.", at=moment - timedelta(days=1)))
        if status == "payment_pending":
            sent = moment - timedelta(days=6)
            s.links.append(PaymentLink(customer_id=customer, amount_type="full", amount_paise=plan.price_paise, url=f"https://pay.poshpaws.in/s/{sid}",
                                       sent_at=sent, expires_at=sent + timedelta(hours=24)))
        subs.append(s)
    return subs


def _member_discount(customer: str, price: int, plans: dict[str, Plan]) -> tuple[str, int] | None:
    """Seeded bookings keep the member discount they had (no plan sessions, so the session counts stay as seeded)."""
    sub = next((x for x in DEMO_SUBSCRIPTIONS if x[1] == customer and x[4] == "active"), None)
    plan = plans[sub[2]] if sub else None
    if not plan or not plan.discount_percent:
        return None
    return f"{plan.name} member {plan.discount_percent}% off", (price * plan.discount_percent + 50) // 100


def _demo_bookings(customers: dict[str, Customer], plans: dict[str, Plan]) -> list[Booking]:
    t, moment = today(), datetime.now(timezone.utc)
    services = {sid: (name, minutes, rupees * 100) for sid, _, name, _, rupees, minutes, _ in DEMO_SERVICES}

    def ago(minutes: int) -> datetime:
        return moment - timedelta(minutes=minutes)

    history = [(f"PP-{1000 + i}", c, pet, svc, "completed", "paid", (2 - day) * 24 * 60, day, time, station, "full", (2 - day) * 24 * 60 - 30, "app")
               for i, (day, c, pet, svc, time, station) in enumerate(DEMO_HISTORY)]
    bookings = []
    for bid, cid, pid, svc, stage, money, created, day, time, station, asks, sent_ago, source in DEMO_BOOKINGS + history:
        name, minutes, price = services[svc]
        discount = _member_discount(cid, price, plans)
        total = price - (discount[1] if discount else 0)
        advance = min(HOLD_PAISE, total) if source == "app" else 0  # app bookings pay the advance online; phone bookings don't
        day_ = t + timedelta(days=day) if day is not None else None
        b = Booking(id=bid, source=source, stage=stage, customer_id=cid, pet_id=pid, service_id=svc, service_name=name, duration_minutes=minutes,
                    date=day_, time=time, station_id=station, created_at=ago(created), booked_by=None if source == "app" else "Meera K.",
                    price_paise=price, total_paise=total, advance_paise=advance, discount_kind="membership" if discount else None,
                    discount_label=discount[0] if discount else None, discount_paise=discount[1] if discount else 0)
        b.customer = customers[cid]
        if stage in ("awaiting_payment", "confirmed", "completed") and day_:
            start = local(day_, time)
            b.held = Range(start, start + timedelta(minutes=minutes + BUFFER_MINUTES))
        log = [(ago(created), "created", "Booked in the app" if source == "app" else "Booking started by phone", None, None if source == "app" else "Meera K.")]

        def pay(kind: str, amount: int, method: str, at: datetime, by: str | None = None, refund_of: str | None = None) -> None:
            b.payments.append(Payment(id=f"PAY-{bid[3:]}-{len(b.payments) + 1}", customer_id=cid, kind=kind, amount_paise=amount, method=method,
                                      at=at, by=by, refund_of=refund_of))

        if sent_ago is not None and day_:
            sent = ago(sent_ago)
            log.append((ago(sent_ago + 2), "details", "Booking details saved", f"{name} · {day_} {time}", None))
            if source == "app":
                pay("advance", advance, "online", sent)
                log.append((sent, "payment", "Advance paid in the app", f"₹{advance // 100}", None))
            elif money in ("paid", "refunded"):
                pay("advance", total, "online", ago(max(0, sent_ago - 20)))
                log += [(sent, "payment", "Payment link sent on WhatsApp", None, "Meera K."), (ago(max(0, sent_ago - 20)), "payment", "Paid online", "Booking confirmed automatically.", None)]
            else:
                b.links.append(PaymentLink(customer_id=cid, amount_type=asks, amount_paise=total, url=f"https://pay.poshpaws.in/l/{bid}", sent_at=sent,
                                           expires_at=sent + timedelta(hours=24), failed=money == "failed"))
                log.append((sent, "payment", "Payment link sent on WhatsApp", None, "Meera K."))
                if money == "failed":
                    log.append((ago(20), "payment", "Payment failed", "The bank declined the payment.", None))
        if stage == "confirmed" and not b.payments and not b.links:
            log.append((ago(created - 5), "status", "Booking confirmed", "Booked by phone. Pays at the shop.", "Meera K."))
        if stage == "completed":
            # The rest was paid at the shop after the groom: mostly by the shop's UPI QR, sometimes cash.
            rest = total - sum(x.amount_paise for x in b.payments)
            if rest > 0:
                pay("balance", rest, "cash" if bid.endswith("3") else "upi_qr", starts_at(day_, time), "Amit J.")
            log.append((starts_at(day_, time), "status", "Marked completed", None, "Amit J."))
        if money == "refunded" and b.payments:
            pay("refund", b.payments[0].amount_paise, "online", ago(60 * 24 * 4), "Sanjay R.", refund_of=b.payments[0].id)
        if stage == "no_show":
            log.append((starts_at(day_, time), "status", "Marked as no-show", None, "Amit J."))
        if stage == "cancelled":
            log.append((ago(60 * 24 * 4), "status", "Booking cancelled", "Customer travelling. The advance was refunded (cancelled 24 h or more before).", "Sanjay R."))
        for at, kind, title, detail, by in sorted(log, key=lambda x: x[0]):
            b.activity.append(BookingActivity(at=at, kind=kind, title=title, detail=detail, by=by))
        settle(b)
        bookings.append(b)
    return bookings


# ── Content: banners, gallery photos and FAQs, as in the admin's demo ──

PAW = ("M12 14c-2.5 0-5 2-5 4.5 0 1.7 1.3 2.5 2.7 2.5 1 0 1.5-.5 2.3-.5s1.3.5 2.3.5c1.4 0 2.7-.8 2.7-2.5 0-2.5-2.5-4.5-5-4.5z"
       "M5.5 11a1.8 2.2 0 1 0 0-4.4 1.8 2.2 0 0 0 0 4.4zM9.5 7a1.8 2.2 0 1 0 0-4.4 1.8 2.2 0 0 0 0 4.4z"
       "M14.5 7a1.8 2.2 0 1 0 0-4.4 1.8 2.2 0 0 0 0 4.4zM18.5 11a1.8 2.2 0 1 0 0-4.4 1.8 2.2 0 0 0 0 4.4z")


def _picture(color: str, width: int = 1200, height: int = 900) -> str:
    """A small coloured stand-in picture with a paw print (an SVG written into the address itself, so no file is needed)."""
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}"><rect width="100%" height="100%" fill="{color}"/>'
           f'<g transform="translate({width / 2 - 60} {height / 2 - 60}) scale(5)" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="1.4">'
           f'<path d="{PAW}"/></g></svg>')
    return f"data:image/svg+xml,{quote(svg)}"


# (placement, title, subtitle, button, link, starts in days, ends in days, colour, paused)
DEMO_BANNERS = [
    ("home_hero", "Diwali grooming week", "20% off every dog service, with the code DIWALI20.", "Book with 20% off", "book", -20, 2, "#2D6A4F", False),
    ("home_hero", "Winter coat care", "De-shedding and deep conditioning for thick winter coats.", "See treatments", "services", 3, 33, "#5C4A33", False),
    ("home_hero", "Monsoon paw care", "Paw cleaning and anti-fungal care after rainy walks.", "Book now", "book", -60, -31, "#C4B49E", False),
    ("home_promo", "Refer a friend, get ₹200", "Your friend gets ₹200 off their first groom too.", "Book now", "book", -200, None, "#F4A261", False),
    ("services", "New: De-shedding Treatment", "Less shedding at home after one session.", "See it", "services", -15, 15, "#2D6A4F", False),
    ("membership", "Royal plan, ₹500 off the first month", "Unlimited grooming for less this month.", "See plans", "membership", -30, 30, "#8A3F0E", True),
]
# (caption, category, pet, colour, shown in the app)
DEMO_PHOTOS = [
    ("Bruno after his Royal Package", "gc-happy", "Golden Retriever", "#C9A26B", True), ("Luna, freshly brushed", "gc-grooming", "Persian", "#B8A99A", True),
    ("Before and after: Rocky", "gc-before-after", "German Shepherd", "#7E6B55", True), ("Coco ready for Diwali", "gc-happy", "Shih Tzu", "#D9B38C", False),
    ("Our grooming room", "gc-studio", "", "#5F7F6C", True), ("Mia at the flea spa", "gc-grooming", "Siamese", "#A89580", True),
    ("Adoption day, September", "gc-events", "", "#3F6E57", True), ("Before and after: Tiger", "gc-before-after", "Indie", "#8C7356", False),
    ("Pumpkin after a cat bath", "gc-grooming", "Ragdoll", "#C2B3A3", True), ("Daisy loves the dryer", "gc-happy", "Beagle", "#B48A5E", True),
]
DEMO_FAQS = [
    ("fg-booking", "How do I book a slot?", "Tap Book now, pick a service, a time and your pet, then confirm with a ₹100 hold. We send the confirmation on WhatsApp."),
    ("fg-booking", "Can I reschedule?", "Yes, up to 24 hours before your slot at no charge."),
    ("fg-booking", "How does the ₹100 hold work?", "It secures your slot and is adjusted in your bill when you arrive."),
    ("fg-membership", "Can I cancel or change my plan anytime?",
     "Yes. You can upgrade, downgrade, or cancel your membership at any time before the next billing cycle. No lock-in, no penalties."),
    ("fg-membership", "Do unused sessions roll over to the next month?",
     "Sessions are valid for the calendar month. They do not roll over, so we recommend booking early to make the most of your plan."),
    ("fg-membership", "Can I use my membership for both dogs and cats?",
     "Absolutely. Your membership covers all pets linked to your profile. Add multiple pets and the sessions are shared across them."),
    ("fg-membership", "How does the ₹100 slot hold work for members?",
     "Members still place a ₹100 refundable hold to confirm a booking. It is fully returned when you arrive for the appointment."),
    ("fg-pets", "Is my pet safe with anxious handling?", "We follow a fear-free approach and move at your pet’s pace."),
    ("fg-pets", "Do you need vaccination records?", "Yes, please share them before the first visit."),
]


def _seed_content(db) -> None:
    t = today()
    # The starting gallery categories, FAQ groups and pages (added the first time they're read).
    gallery(db)
    faq_data(db)
    list_pages(db)
    if _empty(db, Banner):
        for i, (placement, title, subtitle, button, link, starts, ends, color, paused) in enumerate(DEMO_BANNERS):
            db.add(Banner(placement=placement, title=title, subtitle=subtitle, button_text=button, link=link, paused=paused, sort_order=i,
                          starts_on=t + timedelta(days=starts), ends_on=t + timedelta(days=ends) if ends is not None else None,
                          image_url=_picture(color, 1080, 1350), desktop_image_url=_picture(color, 1920, 720)))
        print(f"Added {len(DEMO_BANNERS)} banners.")
    if _empty(db, GalleryPhoto):
        db.add_all(GalleryPhoto(image_url=_picture(color), caption=caption, category_id=category, pet=pet, visible=shown, sort_order=i)
                   for i, (caption, category, pet, color, shown) in enumerate(DEMO_PHOTOS))
        print(f"Added {len(DEMO_PHOTOS)} gallery photos.")
    if _empty(db, Faq):
        db.add_all(Faq(group_id=group, question=q, answer=a, sort_order=i) for i, (group, q, a) in enumerate(DEMO_FAQS))
        print(f"Added {len(DEMO_FAQS)} FAQs.")
        # An unpublished change on the About page, as in the demo.
        about = db.get(SitePage, "about")
        about.draft = [{**s, "visible": True, "body": "Our certified groomers: [names]. Ask for your favourite when you book."} if s["id"] == "about-team" else s
                       for s in about.sections]
        about.draft_saved_at, about.draft_saved_by = datetime.now(timezone.utc) - timedelta(days=1), "Meera K."


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
        db.flush()
        plans = {p.id: p for p in db.scalars(select(Plan))}
        if _empty(db, Subscription) and {"basic", "posh", "royal"} <= plans.keys():
            db.add_all(_demo_subscriptions(plans))
            print(f"Added {len(DEMO_SUBSCRIPTIONS)} memberships and their payments.")
        if _empty(db, Booking) and {"st1", "st2"} <= set(db.scalars(select(Station.id))):
            customers = {c.id: c for c in db.scalars(select(Customer))}
            db.add_all(_demo_bookings(customers, plans))
            print(f"Added {len(DEMO_BOOKINGS) + len(DEMO_HISTORY)} bookings with their payments.")
        _seed_content(db)
        # New bookings and memberships are numbered after the demo ones.
        db.execute(text("select setval('booking_number', greatest(1059, coalesce((select max(substring(id from 4)::int) from bookings), 0)))"))
        db.execute(text("select setval('subscription_number', greatest(110, coalesce((select max(substring(id from 5)::int) from subscriptions), 0)))"))
        db.commit()
        print("Demo data is ready.")


if __name__ == "__main__":
    seed()
