"""Open start times, the day's slot board and block time."""

import datetime as dt
from typing import Literal

from pydantic import ConfigDict, model_validator

from app.core.dates import TIME
from app.core.schemas import CamelModel
from app.shared.settings.schemas import DayHours


class TimeSlot(CamelModel):
    time: str
    available: bool


class DayAvailability(CamelModel):
    """GET /admin/slots: one entry per day."""

    date: dt.date
    slots: list[TimeSlot]


class BoardSlot(CamelModel):
    """One start time on the slot board."""

    time: str
    state: Literal["open", "closed", "extra"]  # a usual time · closed by staff · opened by staff
    free_stations: int  # stations free for a visit starting then (one slot step long)
    blocked_by: str | None  # why it can't be booked whatever its state: "Past", "Break", "Closed · Diwali"
    weekly: Literal["closed", "extra"] | None  # what the usual week says about it; the day's own change wins


class ClosureNote(CamelModel):
    name: str
    closes_at: str | None


class SlotBoardOut(CamelModel):
    """GET /admin/slot-board?date=: the start times customers can book on one day."""

    date: dt.date
    hours: DayHours
    closure: ClosureNote | None
    step_minutes: int
    stations: int
    slots: list[BoardSlot]


class TimeBlockOut(CamelModel):
    id: str
    station_id: str
    date: dt.date
    time: str
    duration_minutes: int
    reason: str
    fixed: bool = False  # breaks and holidays (from Settings) can't be removed from the calendar


class TimeBlockIn(CamelModel):
    """POST /admin/blocks. all_day blocks the station from opening to closing (a day off), whatever time and duration say."""

    model_config = ConfigDict(str_strip_whitespace=True)

    station_id: str
    date: dt.date
    time: str = ""
    duration_minutes: int = 0
    reason: str = ""
    all_day: bool = False

    @model_validator(mode="after")
    def check(self) -> "TimeBlockIn":
        if not self.all_day and not TIME.match(self.time):
            raise ValueError("Pick a start time.")
        return self
