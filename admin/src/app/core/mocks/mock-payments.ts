import { OWNER_ROLES } from '../constants/app.constants';
import { Booking } from '../models/booking.model';
import { Paged } from '../models/paged.model';
import { Payment, PaymentState, PaymentSummary, PaymentTab } from '../models/payment.model';
import { addDays, minutesSince } from '../utils/date.utils';
import { formatInr } from '../utils/money.utils';
import { MockError, MockRequest, NO_ROUTE, db, requireRole, requireStaff, route, save } from './mock-db';

/** Every payment link and what happened to it (Business › Payments). Refunds are Super Admin only. */
export function handlePayments(r: MockRequest): unknown {
  let m: string[] | null;
  if ((m = route(r, 'GET', /^\/payments\/summary$/))) return summary(r.param('from'), r.param('to'));
  if ((m = route(r, 'GET', /^\/payments$/))) return list(r);
  if ((m = route(r, 'POST', /^\/payments\/([^/]+)\/refund$/))) {
    requireRole(r, OWNER_ROLES);
    return refund(m[0], requireStaff(r).name);
  }
  return NO_ROUTE;
}

const month = new Intl.DateTimeFormat('en-IN', { month: 'short' });

function bookingState(b: Booking): PaymentState {
  if (b.paymentStatus === 'paid' || b.paymentStatus === 'failed' || b.paymentStatus === 'refunded') return b.paymentStatus;
  // A cancelled link, or one that ran out, can no longer be paid.
  if (b.paymentStatus === 'not_requested' || minutesSince(b.payment!.expiresAt) > 0) return 'expired';
  return 'link_sent';
}

/** Payments worked out from bookings and subscriptions, newest first, like a database view. */
export function allPayments(): Payment[] {
  const fromBookings = db().bookings.filter(b => b.payment).map((b): Payment => {
    const status = bookingState(b);
    const p = b.payment!;
    return {
      id: `PAY-${b.id.slice(3)}`, kind: 'booking', reference: b.id, item: b.service?.name ?? 'Booking',
      customer: { id: b.customer.id, name: b.customer.name }, amountPaise: p.amountPaise, status,
      at: p.refundedAt ?? p.paidAt ?? p.sentAt, refundable: status === 'paid',
    };
  });
  const linkHours = db().settings.payments.linkExpiryHours;
  const fromPlans = db().subscriptions.flatMap((s): Payment[] => {
    const customer = { id: s.customer.id, name: s.customer.name };
    // Earlier renewals: the plan is paid monthly from the day it started.
    const paid: Payment[] = s.status !== 'active' || !s.renewsOn ? [] : [1, 2]
      .map(k => addDays(s.renewsOn!, -30 * k))
      .filter(paidOn => paidOn >= s.startedOn)
      .map((paidOn, k) => ({
        id: `PAY-${s.id.slice(4)}${k + 1}`, kind: 'plan', reference: `${s.planName} plan · ${month.format(new Date(paidOn))}`, item: 'Plan renewal',
        customer, amountPaise: s.pricePaise, status: 'paid', at: `${paidOn}T10:00:00`, refundable: false,
      }));
    const link: Payment[] = !s.paymentLink ? [] : [{
      id: `PAY-${s.id.slice(4)}0`, kind: 'plan', reference: `${s.planName} plan`, item: s.status === 'payment_pending' ? 'First month' : 'Plan renewal',
      customer, amountPaise: s.pricePaise, status: minutesSince(s.paymentLink.sentAt) > linkHours * 60 ? 'expired' : 'link_sent',
      at: s.paymentLink.sentAt, refundable: false,
    }];
    return [...link, ...paid];
  });
  return [...fromBookings, ...fromPlans].sort((a, b) => b.at.localeCompare(a.at));
}

const TABS: Record<PaymentTab, PaymentState[]> = {
  all: [], waiting: ['link_sent', 'expired'], paid: ['paid'], failed: ['failed'], refunded: ['refunded'],
};

function inPeriod(p: Payment, from: string, to: string): boolean {
  const day = p.at.slice(0, 10);
  return (!from || day >= from) && (!to || day <= to);
}

function list(r: MockRequest): Paged<Payment> {
  const tab = (r.param('tab') || 'all') as PaymentTab;
  const states = TABS[tab] ?? [];
  const rows = allPayments().filter(p => inPeriod(p, r.param('from'), r.param('to')) && (!states.length || states.includes(p.status)));
  const page = Math.max(1, Number(r.param('page')) || 1);
  const pageSize = Math.min(10_000, Math.max(1, Number(r.param('pageSize')) || 20));
  return { items: rows.slice((page - 1) * pageSize, page * pageSize), total: rows.length, page, pageSize };
}

function summary(from: string, to: string): PaymentSummary {
  const all = allPayments();
  const inRange = all.filter(p => inPeriod(p, from, to));
  const sum = (rows: Payment[]) => rows.reduce((total, p) => total + p.amountPaise, 0);
  const paid = inRange.filter(p => p.status === 'paid');
  const waiting = all.filter(p => p.status === 'link_sent');
  const refunded = inRange.filter(p => p.status === 'refunded');
  return {
    collectedPaise: sum(paid), collectedCount: paid.length, waitingPaise: sum(waiting), waitingCount: waiting.length,
    failedCount: inRange.filter(p => p.status === 'failed').length, refundedPaise: sum(refunded), refundedCount: refunded.length,
  };
}

/** Refunds a paid booking payment. The booking itself stays as it is; cancel it separately if needed. */
function refund(id: string, by: string): Payment {
  const b = db().bookings.find(x => `PAY-${x.id.slice(3)}` === id && x.payment);
  if (!b) throw new MockError(404, 'Payment not found, or it can’t be refunded here.');
  if (b.paymentStatus !== 'paid') throw new MockError(409, 'Only paid payments can be refunded.');
  b.paymentStatus = 'refunded';
  b.payment!.refundedAt = new Date().toISOString();
  b.activity.unshift({ at: b.payment!.refundedAt, kind: 'payment', title: 'Payment refunded', detail: formatInr(b.payment!.amountPaise), by });
  save();
  return allPayments().find(p => p.id === id)!;
}
