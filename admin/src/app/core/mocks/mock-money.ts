import { BillDiscount, Booking, BookingBill, PaymentEntry, PaymentStatus } from '../models/booking.model';

// Pure booking-money maths (no database), shared by the seed data and the booking handlers.
// See "Booking & payment rules" in the root CLAUDE.md.

/** Payments minus refunds. */
export function netPaid(payments: PaymentEntry[]): number {
  return payments.reduce((sum, p) => sum + (p.kind === 'refund' ? -p.amountPaise : p.amountPaise), 0);
}

/** A fresh bill. The advance is the hold amount, never more than the total, and none when the total is ₹0. */
export function newBill(servicePricePaise: number, discount: BillDiscount | null, holdPaise: number | null): BookingBill {
  const totalPaise = Math.max(0, servicePricePaise - (discount?.amountPaise ?? 0));
  const advancePaise = holdPaise && totalPaise > 0 ? Math.min(holdPaise, totalPaise) : 0;
  return { servicePricePaise, discount, totalPaise, advancePaise, paidPaise: 0, balancePaise: totalPaise };
}

/** `PAY-1051-2` for the booking's second payment entry. */
export function paymentEntryId(bookingId: string, payments: PaymentEntry[]): string {
  return `PAY-${bookingId.slice(3)}-${payments.length + 1}`;
}

const BOOKED = ['awaiting_payment', 'confirmed', 'completed', 'cancelled', 'no_show'];

/** Updates paid, balance and payment status from the bill, the payments and any open link. */
export function settleMoney(b: Pick<Booking, 'stage' | 'bill' | 'payments' | 'paymentLink' | 'paymentStatus'>): void {
  const paid = netPaid(b.payments);
  if (b.bill) {
    const closed = b.stage === 'cancelled' || b.stage === 'no_show';
    b.bill.paidPaise = paid;
    // Nothing more is due on a cancelled or no-show booking; a kept advance stays paid.
    b.bill.balancePaise = closed ? 0 : Math.max(0, b.bill.totalPaise - paid);
  }
  b.paymentStatus = statusOf(b, paid);
}

function statusOf(b: Pick<Booking, 'stage' | 'bill' | 'payments' | 'paymentLink'>, paid: number): PaymentStatus {
  if (b.payments.some(p => p.kind === 'refund') && paid <= 0) return 'refunded';
  const booked = BOOKED.includes(b.stage);
  if (b.bill && booked && (b.bill.balancePaise === 0 || b.bill.totalPaise === 0) && (paid > 0 || b.bill.totalPaise === 0)) return 'paid';
  if (paid > 0) return 'part_paid';
  if (b.paymentLink?.failed) return 'failed';
  if (b.paymentLink) return 'link_sent';
  return 'unpaid';
}
