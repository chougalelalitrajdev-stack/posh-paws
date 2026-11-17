"""pytest reads this first. Tests use their own database, so they never touch the development data."""

import os

os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://localhost:5432/posh_paws_test")
