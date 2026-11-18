# Posh Paws: backend

REST API for the customer and admin apps, built with Python FastAPI.

## Run

Needs Python 3.12+ and PostgreSQL 17 (on the Mac: `brew install python@3.13 postgresql@17`, then `brew services start postgresql@17`).

```bash
cd backend
createdb posh_paws && createdb posh_paws_test   # once (psql tools live in /opt/homebrew/opt/postgresql@17/bin)
python3.13 -m venv .venv                         # once
source .venv/bin/activate                        # every new terminal
pip install -r requirements.txt                  # once, and after requirements change
cp .env.example .env                             # once, then edit if needed

alembic upgrade head                             # bring the database's tables up to date (after every pull)
python -m app.seed                               # demo staff (owner@ / meera@ / amit@poshpaws.in, password pawsword) and the demo catalog; safe to rerun
uvicorn app.main:app --reload                    # http://localhost:8000/api/health
pytest                                           # tests (they use posh_paws_test)
```

Interactive API docs: http://localhost:8000/docs

## Database changes (migrations)

Tables are defined in each topic's `models.py`. After changing them:

```bash
alembic revision --autogenerate -m "add stations"   # writes a migration file in alembic/versions/ (check it!)
alembic upgrade head                                 # applies it to your database
```

Migrations are committed with the code, so every database (yours, the test one, the online one) reaches the same shape. New topics' models are imported in `alembic/env.py` so Alembic can see them.

## Structure

Organised by **module**, because the product grows: grooming now, a store and doctor appointments later (see `PLAN.md`).

```
backend/
├── app/
│   ├── main.py          creates the app, CORS, error format, registers every router under /api
│   ├── core/            plumbing: settings (config.py), database connection (database.py), CamelModel (schemas.py),
│   │                    error format (errors.py), passwords + sign-in tokens (security.py), the shop's clock and
│   │                    HH:mm helpers (dates.py), health check
│   ├── seed.py          demo data for your own Mac (python -m app.seed), with the admin demo's ids
│   ├── shared/          used by every module: customers, pets, staff & roles, payments, notifications, settings, uploads
│   ├── grooming/        catalog (services + stations), plans, offers, slots, bookings, money (the Payments page), dashboard (Today); later subscriptions
│   ├── shop/            (later)
│   └── vet/             (later)
├── alembic/             migrations: versions/ holds one file per database change
├── tests/               pytest, mirroring app/: tests/grooming/test_bookings.py, ... (conftest.py points them at posh_paws_test)
├── requirements.txt
└── .env.example
```

Inside a module, one folder per topic, always the same four files:

```
app/grooming/bookings/
├── models.py     the database tables (SQLAlchemy)
├── schemas.py    request and response shapes (Pydantic, camelCase JSON)
├── service.py    the rules (slot availability, booking rules, ...)
└── routes.py     the endpoints
```

A request flows **route → service → database**. Routes stay thin: they validate input with a schema, call a service and return a schema. Rules live in services, so they can be tested without HTTP. A module may use `shared/` and `core/`, never another module (the store doesn't import grooming).

## Adding a topic (example: grooming bookings)

1. `app/grooming/bookings/models.py`: the `bookings` table
2. `app/grooming/bookings/schemas.py`: `BookingCreate`, `BookingOut`
3. `app/grooming/bookings/service.py`: `list_bookings`, `confirm_booking`, ...
4. `app/grooming/bookings/routes.py`: `router = APIRouter(prefix="/admin/bookings", tags=["bookings"])`
5. `main.py`: `app.include_router(bookings_routes.router, prefix="/api")`
6. `tests/grooming/test_bookings.py`

Later modules use their own URL prefix: `/api/admin/shop/orders`, `/api/admin/vet/appointments`.

## Conventions

- Follow the API contract in the root `CLAUDE.md`: camelCase JSON, money in integer paise, errors as `{"detail": "..."}`.
- Request and response shapes inherit `CamelModel` (`app.core.schemas`), so Python stays snake_case and the JSON is camelCase.
- Routes get a database session with `db: Session = Depends(get_db)` (`app.core.database`).
- "Today" and times are the shop's (`app.core.dates.today()`, Asia/Kolkata), never the server's.
- A single set of options (a settings section) is one JSONB row with defaults in code; a list of things (holidays, templates, services, later bookings) is a table with one row each. A short list inside one row (a station's service ids) is an `ARRAY` column; services are archived, never deleted, so those ids stay valid.
- Related tables are linked by a foreign key (`pets.customer_id` → `customers.id`) plus a `relationship()`, so `customer.pets` and `pet.owner` work in Python. When a list shows related rows, load them with `selectinload(...)` (one extra query for the whole page, not one per row).
- Long lists answer one page at a time as `Paged` (`app.core.schemas`): `?page=1&pageSize=10` in, `{items, total, page, pageSize}` out. Text search uses `column.icontains(text, autoescape=True)` (any case, and `%` typed by a user is just a character).
- A rule the database must guarantee even when two requests arrive at the same instant is a database constraint, not only a Python check: unique codes and phone numbers, and `no_double_booking` (an exclusion constraint on each booking's `held` time range per station). Python checks first to give a friendly message; the constraint is the safety net (`IntegrityError` → 409).
- Times inside a day are shop-local: dates are `date`, times `"HH:mm"` strings, and a booking's held time is a `TSRANGE` without a timezone. Compare with "now" through `app.core.dates` (`starts_at(day, "10:30")` vs `now()`).
- Migrations can need a hand-written line; Alembic doesn't write extensions or standalone sequences (see the bookings migration: `btree_gist`, `booking_number`). Run `alembic check` to confirm the models and migrations match.
- Money in and out is one shared table, `payments` (`app/shared/payments`), with a column for what it was for (`booking_id` now; memberships, store orders and vet visits add theirs). Amounts are always positive; a refund is its own row pointing at the payment it gives back. Totals, balances and the payment status are worked out from those rows (`net_paid`, `settle`), never typed in.
- Checks on the shape of a request (required fields, ranges, choices) live in `schemas.py` and answer 422; rules that need the database (a unique name or code, ids that exist, "keep one station in use") live in `service.py` and answer 400, 404 or 409.
- Staff routes are protected with `Depends(require_roles(*SETTINGS_ROLES))` (or `current_staff` for any signed-in staff) from `app.shared.staff.service`, which also holds the permissions list. 401 = not signed in, 403 = signed in but not allowed.
- Raise `HTTPException(status_code=..., detail="...")` for expected errors.
- Settings come from `core/config.py` (environment variables or `.env`), never hard-coded.
