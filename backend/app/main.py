from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core import health
from app.core.config import settings
from app.core.errors import add_error_handlers
from app.grooming.bookings import routes as booking_routes
from app.grooming.catalog import routes as catalog_routes
from app.grooming.dashboard import routes as dashboard_routes
from app.grooming.money import routes as money_routes
from app.grooming.offers import routes as offer_routes
from app.grooming.plans import routes as plan_routes
from app.grooming.slots import routes as slot_routes
from app.shared.customers import routes as customer_routes
from app.shared.settings import routes as settings_routes
from app.shared.staff import routes as staff_routes
from app.shared.templates import routes as template_routes

app = FastAPI(title=settings.app_name)
add_error_handlers(app)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
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
app.include_router(slot_routes.slots_router, prefix="/api")
app.include_router(slot_routes.board_router, prefix="/api")
app.include_router(slot_routes.blocks_router, prefix="/api")
app.include_router(booking_routes.router, prefix="/api")
app.include_router(booking_routes.calendar_router, prefix="/api")
app.include_router(money_routes.router, prefix="/api")
app.include_router(money_routes.customer_router, prefix="/api")
app.include_router(dashboard_routes.router, prefix="/api")
