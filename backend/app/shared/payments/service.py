"""Small money rules every module uses the same way."""

import datetime as dt

from app.shared.payments.models import Payment, PaymentLink

METHOD_LABELS = {"online": "Online", "upi_qr": "Shop QR (UPI)", "cash": "Cash", "card": "Card"}
KIND_LABELS = {"advance": "Advance", "balance": "Balance", "plan": "Plan", "upgrade": "Difference", "refund": "Refund"}


def net_paid(payments: list[Payment]) -> int:
    """Payments minus refunds."""
    return sum(-p.amount_paise if p.kind == "refund" else p.amount_paise for p in payments)


def refunded_ids(payments: list[Payment]) -> set[str]:
    """The payments that have been given back."""
    return {p.refund_of for p in payments if p.refund_of}


def open_link(links: list[PaymentLink]) -> PaymentLink | None:
    return next((link for link in links if link.closed_at is None), None)


def link_state(link: PaymentLink) -> str:
    """failed (the bank declined it) · expired (it ran out unpaid) · link_sent (waiting for the customer)."""
    if link.failed:
        return "failed"
    return "expired" if link.expires_at < dt.datetime.now(dt.timezone.utc) else "link_sent"
