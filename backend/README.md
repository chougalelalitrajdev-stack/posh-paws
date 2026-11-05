# Posh Paws: backend

REST API for the customer and admin apps, built with Python FastAPI.

## Run

```bash
cd backend
python3 -m venv .venv            # once
source .venv/bin/activate        # every new terminal
pip install -r requirements.txt  # once, and after requirements change
cp .env.example .env             # once, then edit if needed

uvicorn app.main:app --reload    # http://localhost:8000/api/health
pytest                           # tests
```

Interactive API docs: http://localhost:8000/docs

## Structure

Organised by **module**, because the product grows: grooming now, a store and doctor appointments later (see `PLAN.md`).

```
backend/
├── app/
│   ├── main.py          creates the app, CORS, registers every router under /api
│   ├── core/            plumbing: settings (config.py), health check; later database connection, login tokens, error handlers
│   ├── shared/          used by every module: customers, pets, staff & roles, payments, notifications, settings, uploads
│   ├── grooming/        services, stations, slots, bookings, membership plans
│   ├── shop/            (later)
│   └── vet/             (later)
├── tests/               pytest, mirroring app/: tests/grooming/test_bookings.py, ...
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
- Raise `HTTPException(status_code=..., detail="...")` for expected errors.
- Settings come from `core/config.py` (environment variables or `.env`), never hard-coded.
