"""Dates and times in the shop's timezone (settings.timezone), and the HH:mm helpers slots use."""

import re
from datetime import date, datetime
from zoneinfo import ZoneInfo

from app.core.config import settings

TIME = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")  # HH:mm, 24-hour


def now() -> datetime:
    """The time in Pune (or wherever settings.timezone says), whatever timezone the server runs in."""
    return datetime.now(ZoneInfo(settings.timezone))


def today() -> date:
    return now().date()


def minutes_of_day(time: str) -> int:
    """"09:30" → 570."""
    hours, minutes = time.split(":")
    return int(hours) * 60 + int(minutes)


def time_from_minutes(minutes: int) -> str:
    """570 → "09:30"."""
    return f"{minutes // 60:02d}:{minutes % 60:02d}"
