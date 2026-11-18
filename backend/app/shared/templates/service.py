"""Message templates: the starting texts, when each goes out, and the editing rules."""

import datetime as dt
import re

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.shared.settings.service import get_section
from app.shared.templates.models import MessageTemplate
from app.shared.templates.schemas import TemplateIn, TemplateOut

# The {fields} a message may use; each screen fills them in for one customer (admin: core/constants/template.constants.ts).
FIELDS = {"customer_name", "pet_name", "service", "date_time", "amount", "payment_link", "link_hours", "plan", "renewal_date"}
MAX_LENGTH = 1000

# The starting texts: (key, group, name, body, can auto-send, approval). Added to the database the first time they're read.
DEFAULT_TEMPLATES = [
    ("payment_link", "Bookings", "Payment link",
     "Hi {customer_name}, {pet_name}'s grooming at Posh Paws is almost booked.\n{service} · {date_time}\nPay {amount} here to confirm: {payment_link}\nThe link works for {link_hours} hours. Reply here if you need to change anything.",
     False, "approved"),
    ("booking_confirmed", "Bookings", "Booking confirmed",
     "Thank you, {customer_name}! {pet_name} is booked for {service} on {date_time}. We'll remind you the evening before. Reply here to reschedule.",
     True, "approved"),
    ("booking_reminder", "Bookings", "Reminder the day before",
     "See you tomorrow, {customer_name}! {pet_name}'s {service} is at {date_time}. Please arrive 10 minutes early.",
     True, "approved"),
    ("unpaid_nudge", "Bookings", "Unpaid link nudge",
     "Hi {customer_name}, we're still holding {date_time} for {pet_name}. Pay {amount} to keep it: {payment_link}",
     True, "pending"),
    ("plan_payment", "Membership", "First plan payment",
     "Hi {customer_name}, welcome to the {plan} plan at Posh Paws!\nPay {amount} here to start your membership: {payment_link}\nReply here if you have any questions.",
     False, "approved"),
    ("plan_renewal", "Membership", "Renewal reminder",
     "Hi {customer_name}, your {plan} plan at Posh Paws renews on {renewal_date}.\nPay {amount} here to keep your sessions and member prices: {payment_link}\nReply here if you have any questions.",
     True, "approved"),
    ("plan_welcome", "Membership", "Welcome to a plan",
     "Welcome to the {plan} plan, {customer_name}! Your sessions are ready to book.",
     True, "draft"),
    ("win_back", "Membership", "Win back",
     "Hi {customer_name}, we miss you at Posh Paws!\nYour {plan} plan has ended. Reply here and we'll restart it, or book a visit any time.",
     False, "approved"),
]


def _trigger(db: Session, key: str) -> str:
    """When each message goes out. The timed ones follow Settings › Notifications."""
    n = get_section(db, "notifications")
    return {
        "payment_link": "Sent by staff from a booking",
        "booking_confirmed": "When a booking is confirmed",
        "booking_reminder": f"At {n.reminder_time} the day before",
        "unpaid_nudge": f"{n.unpaid_nudge_hours} hours after the link, if unpaid",
        "plan_payment": "Sent by staff from Subscriptions",
        "plan_renewal": "3 days before renewal; staff can also send it from Subscriptions",
        "plan_welcome": "Right after the first plan payment",
        "win_back": "Sent by staff from Subscriptions",
    }.get(key, "Sent by staff")


def _out(db: Session, t: MessageTemplate) -> TemplateOut:
    return TemplateOut.model_validate({**{c: getattr(t, c) for c in TemplateOut.model_fields if c != "trigger"}, "trigger": _trigger(db, t.key)})


def _ensure_defaults(db: Session) -> None:
    """Adds any starting text the database doesn't have yet (a fresh database, or a message added in a later version)."""
    have = set(db.scalars(select(MessageTemplate.key)))
    for i, (key, group, name, body, can_auto, approval) in enumerate(DEFAULT_TEMPLATES):
        if key not in have:
            db.add(MessageTemplate(key=key, group=group, name=name, body=body, can_auto_send=can_auto,
                                   auto_send=can_auto and approval == "approved", approval=approval, sort_order=i, updated_by="Posh Paws"))
    db.commit()


def list_templates(db: Session) -> list[TemplateOut]:
    _ensure_defaults(db)
    return [_out(db, t) for t in db.scalars(select(MessageTemplate).order_by(MessageTemplate.sort_order))]


def update(db: Session, key: str, body: TemplateIn, by: str) -> TemplateOut:
    """A changed text goes back to WhatsApp for approval before it can be sent automatically."""
    _ensure_defaults(db)
    t = db.get(MessageTemplate, key)
    if not t:
        raise HTTPException(status_code=404, detail="Template not found.")
    text = body.body.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Write the message.")
    if len(text) > MAX_LENGTH:
        raise HTTPException(status_code=400, detail=f"Keep the message under {MAX_LENGTH} characters.")
    unknown = next((f for f in re.findall(r"\{([^{}]*)\}", text) if f not in FIELDS), None)
    if unknown is not None:
        raise HTTPException(status_code=400, detail=f"{{{unknown}}} isn't a field. Use the Insert buttons to add one.")
    if text != t.body:
        t.approval = "pending"
    t.body, t.auto_send = text, t.can_auto_send and body.auto_send
    t.updated_at, t.updated_by = dt.datetime.now(dt.timezone.utc), by
    db.commit()
    return _out(db, t)
