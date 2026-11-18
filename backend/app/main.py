from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core import health
from app.core.config import settings
from app.core.errors import add_error_handlers
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
