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

```
backend/
├── app/
│   ├── main.py          creates the app, CORS, registers every router under /api
│   ├── core/            settings (config.py), later security (JWT) and error handlers
│   ├── api/routes/      endpoints, one file per resource: pets.py, bookings.py, ...
│   ├── schemas/         request/response shapes (Pydantic), one file per resource
│   ├── services/        business logic (slot availability, booking rules), one file per resource
│   ├── models/          database tables (SQLAlchemy), one file per resource
│   └── db/              database connection and session
├── tests/               pytest, one test_<resource>.py per routes file
├── requirements.txt
└── .env.example
```

A request flows **route → service → database**. Routes stay thin: they validate input with a schema, call a service and return a schema. Rules live in services, so they can be tested without HTTP.

## Adding a resource (example: pets)

1. `schemas/pet.py`: `PetCreate`, `PetOut`
2. `models/pet.py`: the `pets` table
3. `services/pet_service.py`: `list_pets`, `create_pet`, ...
4. `api/routes/pets.py`: `router = APIRouter(prefix="/pets", tags=["pets"])`
5. `main.py`: `app.include_router(pets.router, prefix="/api")`
6. `tests/test_pets.py`

## Conventions

- Follow the API contract in the root `CLAUDE.md`: camelCase JSON, money in integer paise, errors as `{"detail": "..."}`.
- Raise `HTTPException(status_code=..., detail="...")` for expected errors.
- Settings come from `core/config.py` (environment variables or `.env`), never hard-coded.
