"""The database connection: one engine for the app, one session per request."""

from collections.abc import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import settings

# The engine keeps a small pool of open connections to PostgreSQL and reuses them.
# pool_pre_ping checks a connection still works before using it (e.g. after the database restarted).
# echo prints each query in the server's terminal when SQL_ECHO is on.
engine = create_engine(settings.database_url, pool_pre_ping=True, echo=settings.sql_echo)

SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    """Every table class inherits from this, so Alembic can find all the tables."""


def get_db() -> Iterator[Session]:
    """Gives a route its own session (a short conversation with the database) and closes it when the request ends."""
    with SessionLocal() as session:
        yield session
