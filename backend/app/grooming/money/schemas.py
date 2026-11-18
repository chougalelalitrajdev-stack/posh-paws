"""Payments page rows and totals (admin: core/models/payment.model.ts)."""

import datetime as dt
from typing import Literal

from app.core.schemas import CamelModel

PaymentState = Literal["due", "link_sent", "expired", "paid", "failed", "refunded"]


class PaymentCustomer(CamelModel):
    id: str
    name: str


class PaymentRow(CamelModel):
    """One row on Payments: a payment or refund, an open payment link, or a balance still due."""

    id: str  # PAY-1051-1, or PP-1051-LINK / PP-1051-DUE for a link or a balance
    kind: Literal["booking", "plan"]
    reference: str  # the booking id (or the plan, Module 7)
    item: str  # the service name
    detail: str  # what it was and how it came in: "Advance · Online", "Balance · Shop QR (UPI)"
    customer: PaymentCustomer
    amount_paise: int
    status: PaymentState
    at: dt.datetime  # when it last changed
    refundable: bool  # a payment not refunded yet (Super Admin)


class PaymentSummary(CamelModel):
    """GET /admin/payments/summary for a period. Money still open (links waiting, balances due) counts whatever the period."""

    collected_paise: int
    collected_count: int
    waiting_paise: int
    waiting_count: int
    due_paise: int
    due_count: int
    failed_count: int
    refunded_paise: int
    refunded_count: int
