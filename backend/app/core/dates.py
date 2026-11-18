"""Dates and times in the shop's timezone (settings.timezone), and the HH:mm helpers slots use."""

import re
from datetime import date, datetime, time
from zoneinfo import ZoneInfo

from app.core.config import settings

TIME = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")  # HH:mm, 24-hour


def now() -> datetime:
    """The time in Pune (or wherever settings.timezone says), whatever timezone the server runs in."""
    return datetime.now(ZoneInfo(settings.timezone))


def today() -> date:
    return now().date()


def local(day: date, hhmm: str) -> datetime:
    """A day and an HH:mm in the shop's local time, without a timezone (how slot times are stored)."""
    hours, minutes = hhmm.split(":")
    return datetime.combine(day, time(int(hours), int(minutes)))


def starts_at(day: date, hhmm: str) -> datetime:
    """The moment an appointment starts, as a real point in time (to compare with now())."""
    return local(day, hhmm).replace(tzinfo=ZoneInfo(settings.timezone))


def add_months(day: date, months: int) -> date:
    """31 Jan + 1 month = 28 (or 29) Feb: the same day of the month, or the month's last day."""
    month0 = day.month - 1 + months
    year, month = day.year + month0 // 12, month0 % 12 + 1
    next_first = date(year + (month == 12), month % 12 + 1, 1)
    return date(year, month, min(day.day, (next_first - date(year, month, 1)).days))


def shop_date(moment: datetime) -> date:
    """The shop's calendar day for a stored timestamp (a payment at 00:30 in Pune belongs to that day, not the day before in UTC)."""
    return moment.astimezone(ZoneInfo(settings.timezone)).date()


def age_label(moment: datetime) -> str:
    """How long ago: "45 min", "3 h 20 min", "2 days"."""
    minutes = max(0, round((now() - moment).total_seconds() / 60))
    if minutes < 60:
        return f"{minutes} min"
    if minutes < 24 * 60:
        hours, rest = divmod(minutes, 60)
        return f"{hours} h {rest} min" if rest else f"{hours} h"
    days = minutes // (24 * 60)
    return f"{days} day{'s' if days > 1 else ''}"


def short_date(day: date) -> str:
    """"Thu 19 Nov", as the apps show dates."""
    return f"{day:%a} {day.day} {day:%b}"


def minutes_of_day(time: str) -> int:
    """"09:30" → 570."""
    hours, minutes = time.split(":")
    return int(hours) * 60 + int(minutes)


def time_from_minutes(minutes: int) -> str:
    """570 → "09:30"."""
    return f"{minutes // 60:02d}:{minutes % 60:02d}"
