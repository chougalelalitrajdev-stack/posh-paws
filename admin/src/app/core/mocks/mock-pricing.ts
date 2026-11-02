import { BillDiscount, Booking, BookingBill, PaymentEntry, PaymentMethod } from '../models/booking.model';
import { Offer } from '../models/offer.model';
import { Subscription } from '../models/subscription.model';
import { slotStart } from '../utils/date.utils';
import { formatInr } from '../utils/money.utils';
import { MockError, StoredPlan, db } from './mock-db';
import { netPaid, newBill, paymentEntryId, settleMoney } from './mock-money';
import { statusOf } from './mock-offers';

// The bill rules (root CLAUDE.md › Booking & payment rules), as the backend will apply them.

/** The customer's active plan and how many sessions are left this period (Infinity = unlimited). */
function membership(customerId: string): { sub: Subscription; plan: StoredPlan; left: number } | null {
  const sub = db().subscriptions.find(s => s.customer.id === customerId && s.status === 'active');
  const plan = sub && db().plans.find(p => p.id === sub.planId);
  if (!sub || !plan) return null;
  return { sub, plan, left: sub.sessionsTotal === null ? Infinity : sub.sessionsTotal - sub.sessionsUsed };
}

const COUNTED = ['awaiting_payment', 'confirmed', 'completed', 'no_show'];

/** The discount an offer gives on this service for this customer. A typed code that can't be used throws 400 with the reason. */
function offerDiscount(customerId: string, serviceId: string, price: number, code: string | null | undefined, excludeBookingId?: string): BillDiscount | null {
  const service = db().services.find(s => s.id === serviceId)!;
  const theirs = db().bookings.filter(b => b.customer.id === customerId && b.id !== excludeBookingId && COUNTED.includes(b.stage));
  const amount = (o: Offer) => (o.discountType === 'percent' ? Math.round((price * o.value) / 100) : Math.min(o.value, price));
  const problem = (o: Offer): string | null => {
    const status = statusOf(o);
    if (status === 'scheduled') return `${o.code} starts on ${o.startsOn}.`;
    if (status !== 'live') return `${o.code ?? o.title} isn’t running right now.`;
    if (o.appliesTo === 'plans' || (o.appliesTo === 'some_services' && !o.serviceIds.includes(serviceId))) return `${o.code ?? o.title} doesn’t apply to ${service.name}.`;
    if (o.newCustomersOnly && theirs.length) return `${o.code ?? o.title} is for a customer’s first booking only.`;
    if (o.perCustomer !== null && theirs.filter(b => b.bill?.discount?.offerId === o.id).length >= o.perCustomer) return `This customer has already used ${o.code ?? o.title}.`;
    return null;
  };
  const toDiscount = (o: Offer): BillDiscount => ({ kind: 'offer', label: o.code ? `${o.code} · ${o.title}` : o.title, amountPaise: amount(o), offerId: o.id });

  if (code?.trim()) {
    const o = db().offers.find(x => x.code === code.trim().toUpperCase());
    if (!o) throw new MockError(400, `There’s no offer with the code ${code.trim().toUpperCase()}.`);
    const why = problem(o);
    if (why) throw new MockError(400, why);
    return toDiscount(o);
  }
  // Automatic offers (no code): the best one that applies.
  const auto = db().offers.filter(o => o.code === null && !problem(o)).map(toDiscount);
  return auto.sort((a, b) => b.amountPaise - a.amountPaise)[0] ?? null;
}

/**
 * The bill for a service: a plan session (₹0) if the member has one left for it, otherwise the better of
 * the member discount and an offer (they don't stack). `withAdvance` = booked in the customer app.
 */
export function quoteBill(customerId: string, serviceId: string, offerCode: string | null | undefined, withAdvance: boolean, excludeBookingId?: string): BookingBill {
  const service = db().services.find(s => s.id === serviceId);
  if (!service) throw new MockError(404, 'Service not found.');
  const price = service.pricePaise;
  const member = membership(customerId);
  const hold = withAdvance ? db().settings.payments.slotHoldPaise : null;

  if (member && member.plan.eligibleServiceIds.includes(serviceId) && member.left > 0) {
    // No count in the label: the bill is kept, and a count would go stale.
    return newBill(price, { kind: 'session', label: `${member.plan.name} plan session`, amountPaise: price }, hold);
  }
  const options: BillDiscount[] = [];
  if (member && member.plan.discountPercent > 0) {
    options.push({ kind: 'membership', label: `${member.plan.name} member ${member.plan.discountPercent}% off`, amountPaise: Math.round((price * member.plan.discountPercent) / 100) });
  }
  const offer = offerDiscount(customerId, serviceId, price, offerCode, excludeBookingId);
  if (offer) options.push(offer);
  const best = options.sort((a, b) => b.amountPaise - a.amountPaise)[0] ?? null;
  return newBill(price, best, hold);
}

/** A confirmed booking uses its plan session and its offer. */
export function reserve(b: Booking): void {
  const d = b.bill?.discount;
  if (d?.kind === 'session') {
    const member = membership(b.customer.id);
    if (member && member.sub.sessionsTotal !== null) member.sub.sessionsUsed++;
  }
  if (d?.kind === 'offer') {
    const o = db().offers.find(x => x.id === d.offerId);
    if (o) o.used++;
  }
}

/** A cancelled booking gives its session and offer use back. */
export function release(b: Booking): void {
  const d = b.bill?.discount;
  if (d?.kind === 'session') {
    const member = membership(b.customer.id);
    if (member && member.sub.sessionsTotal !== null) member.sub.sessionsUsed = Math.max(0, member.sub.sessionsUsed - 1);
  }
  if (d?.kind === 'offer') {
    const o = db().offers.find(x => x.id === d.offerId);
    if (o) o.used = Math.max(0, o.used - 1);
  }
}

export function addPayment(b: Booking, kind: PaymentEntry['kind'], amountPaise: number, method: PaymentMethod, by?: string, refundOf?: string): PaymentEntry {
  const entry: PaymentEntry = { id: paymentEntryId(b.id, b.payments), kind, amountPaise, method, at: new Date().toISOString(), ...(by && { by }), ...(refundOf && { refundOf }) };
  b.payments.push(entry);
  settleMoney(b);
  return entry;
}

/**
 * On cancel: an online advance is refunded when the slot is at least `freeCancellationHours` away, otherwise kept.
 * Returns the line for the activity log, or null when no advance was paid.
 */
export function refundAdvanceOnCancel(b: Booking): string | null {
  const advances = b.payments.filter(p => p.kind === 'advance' && p.method === 'online' && !b.payments.some(r => r.refundOf === p.id));
  const amount = netPaid(advances);
  if (!amount) return null;
  const hours = db().settings.payments.freeCancellationHours;
  const early = !b.date || !b.time || slotStart(b.date, b.time).getTime() - Date.now() >= hours * 3_600_000;
  if (!early) return `The ${formatInr(amount)} advance is kept (cancelled less than ${hours} h before).`;
  for (const p of advances) addPayment(b, 'refund', p.amountPaise, 'online', undefined, p.id);
  return `The ${formatInr(amount)} advance was refunded (cancelled ${hours} h or more before).`;
}
