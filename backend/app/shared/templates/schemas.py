"""Message template shapes."""

import datetime as dt
from typing import Literal

from app.core.schemas import CamelModel


class TemplateOut(CamelModel):
    key: str
    group: Literal["Bookings", "Membership"]
    name: str
    body: str
    # When it goes out, e.g. "At 18:00 the day before" (worked out from Settings › Notifications).
    trigger: str
    can_auto_send: bool
    auto_send: bool
    approval: Literal["approved", "pending", "draft"]
    updated_at: dt.datetime
    updated_by: str


class TemplateIn(CamelModel):
    body: str
    auto_send: bool = False
