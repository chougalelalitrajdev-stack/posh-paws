from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core import health
from app.core.config import production_problems, settings
from app.core.errors import add_error_handlers
from app.grooming.bookings import routes as booking_routes
from app.grooming.catalog import routes as catalog_routes
from app.grooming.dashboard import routes as dashboard_routes
from app.grooming.money import routes as money_routes
from app.grooming.offers import routes as offer_routes
from app.grooming.plans import routes as plan_routes
from app.grooming.slots import routes as slot_routes
from app.grooming.subscriptions import routes as subscription_routes
from app.shared.content import routes as content_routes
from app.shared.customer_login import routes as customer_login_routes
from app.shared.customers import routes as customer_routes
from app.shared.settings import routes as settings_routes
from app.shared.staff import routes as staff_routes
from app.shared.templates import routes as template_routes
from app.shared.uploads import routes as upload_routes

if settings.production and (problems := production_problems(settings)):
    raise RuntimeError("Not starting: " + " ".join(problems))

# Online, the interactive /docs page is off: it would show anyone every address the API has.
app = FastAPI(title=settings.app_name, **({"docs_url": None, "redoc_url": None, "openapi_url": None} if settings.production else {}))
add_error_handlers(app)


@app.middleware("http")
async def safety_headers(request, call_next):
    """Standard browser safety settings on every reply: files keep the type we say (no guessing a photo is a page),
    the API can't be framed inside another site, and addresses aren't passed on to other sites."""
    response = await call_next(request)
    response.headers.update({"X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY", "Referrer-Policy": "no-referrer"})
    return response


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    # No cookies: sign-in travels in the Authorization header, which other sites can't make a browser send (no CSRF).
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Every route lives under /api. Add one line per topic's routes.py (e.g. app.grooming.bookings.routes).
app.include_router(health.router, prefix="/api")
app.include_router(staff_routes.auth_router, prefix="/api")
app.include_router(staff_routes.team_router, prefix="/api")
app.include_router(settings_routes.router, prefix="/api")
app.include_router(settings_routes.week_router, prefix="/api")
app.include_router(template_routes.router, prefix="/api")
app.include_router(catalog_routes.router, prefix="/api")
app.include_router(catalog_routes.station_router, prefix="/api")
app.include_router(plan_routes.router, prefix="/api")
app.include_router(offer_routes.router, prefix="/api")
app.include_router(customer_routes.router, prefix="/api")
app.include_router(customer_routes.pet_router, prefix="/api")
app.include_router(customer_routes.search_router, prefix="/api")
app.include_router(slot_routes.slots_router, prefix="/api")
app.include_router(slot_routes.board_router, prefix="/api")
app.include_router(slot_routes.blocks_router, prefix="/api")
app.include_router(booking_routes.router, prefix="/api")
app.include_router(booking_routes.calendar_router, prefix="/api")
app.include_router(money_routes.router, prefix="/api")
app.include_router(money_routes.customer_router, prefix="/api")
app.include_router(dashboard_routes.router, prefix="/api")
app.include_router(subscription_routes.router, prefix="/api")
app.include_router(upload_routes.router, prefix="/api")

# The customer app (no /admin in the address).
app.include_router(customer_login_routes.router, prefix="/api")
app.include_router(catalog_routes.public_router, prefix="/api")
app.include_router(plan_routes.public_router, prefix="/api")
app.include_router(settings_routes.shop_router, prefix="/api")
app.include_router(slot_routes.public_router, prefix="/api")
app.include_router(content_routes.public_router, prefix="/api")
app.include_router(content_routes.banner_router, prefix="/api")
app.include_router(content_routes.gallery_router, prefix="/api")
app.include_router(content_routes.page_router, prefix="/api")
app.include_router(content_routes.faq_router, prefix="/api")

# Uploaded photos on your Mac, at http://localhost:8000/uploads/<name> (online they're in the photo storage bucket).
Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.upload_dir), name="uploads")
