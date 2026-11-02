import { OWNER_ROLES } from '../constants/app.constants';
import { PAYMENT_METHODS } from '../constants/status.constants';
import { Booking, PaymentEntry } from '../models/booking.model';
import { Paged } from '../models/paged.model';
import { Payment, PaymentState, PaymentSummary, PaymentTab } from '../models/payment.model';
import { addDays, minutesSince } from '../utils/date.utils';
import { formatInr } from '../utils/money.utils';
import { MockError, MockRequest, NO_ROUTE, db, requireRole, requireStaff, route, save } from './mock-db';
import { addPayment } from './mock-pricing';

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

const KIND_LABEL: Record<PaymentEntry['kind'], string> = { advance: 'Advance', balance: 'Balance', refund: 'Refund' };

/** One row per payment entry, plus open links and balances still due. */
function bookingRows(b: Booking): Payment[] {
  const base = { kind: 'booking' as const, reference: b.id, item: b.service?.name ?? 'Booking', customer: { id: b.customer.id, name: b.customer.name } };
  const rows: Payment[] = b.payments.map(p => ({
    ...base, id: p.id, amountPaise: p.amountPaise, at: p.at,
    detail: `${KIND_LABEL[p.kind]} · ${PAYMENT_METHODS[p.method]}`,
    status: p.kind === 'refund' ? 'refunded' : 'paid',
    refundable: p.kind !== 'refund' && !b.payments.some(r => r.refundOf === p.id),
  }));
  const link = b.paymentLink;
  if (link) {
    // A link that ran out can no longer be paid.
    const status = link.failed ? 'failed' : minutesSince(link.expiresAt) > 0 ? 'expired' : 'link_sent';
    rows.push({ ...base, id: `${b.id}-LINK`, amountPaise: link.amountPaise, at: link.sentAt, detail: `Payment link · ${link.amountType === 'hold' ? 'advance' : 'full amount'}`, status, refundable: false });
  } else if (b.bill?.balancePaise && (b.stage === 'confirmed' || b.stage === 'completed')) {
    const at = b.date && b.time ? `${b.date}T${b.time}:00` : b.createdAt;
    rows.push({ ...base, id: `${b.id}-DUE`, amountPaise: b.bill.balancePaise, at, detail: b.stage === 'completed' ? 'Balance · after the visit' : 'Balance · at the visit', status: 'due', refundable: false });
  }
  return rows;
}

/** Payments worked out from bookings and subscriptions, newest first, like a database view. */
export function allPayments(): Payment[] {
  const fromBookings = db().bookings.flatMap(bookingRows);
  const linkHours = db().settings.payments.linkExpiryHours;
  const fromPlans = db().subscriptions.flatMap((s): Payment[] => {
    const customer = { id: s.customer.id, name: s.customer.name };
    // Earlier renewals: the plan is paid monthly from the day it started.
    const paid: Payment[] = s.status !== 'active' || !s.renewsOn ? [] : [1, 2]
      .map(k => addDays(s.renewsOn!, -30 * k))
      .filter(paidOn => paidOn >= s.startedOn)
      .map((paidOn, k) => ({
        id: `PAY-${s.id.slice(4)}${k + 1}`, kind: 'plan', reference: `${s.planName} plan · ${month.format(new Date(paidOn))}`, item: 'Plan renewal',
        detail: 'Plan · Online', customer, amountPaise: s.pricePaise, status: 'paid', at: `${paidOn}T10:00:00`, refundable: false,
      }));
    const link: Payment[] = !s.paymentLink ? [] : [{
      id: `PAY-${s.id.slice(4)}0`, kind: 'plan', reference: `${s.paymentLink.planName} plan`, item: s.status === 'payment_pending' ? 'First month' : 'Plan renewal',
      detail: 'Payment link', customer, amountPaise: s.paymentLink.amountPaise, status: minutesSince(s.paymentLink.sentAt) > linkHours * 60 ? 'expired' : 'link_sent',
      at: s.paymentLink.sentAt, refundable: false,
    }];
    // Upgrades: the difference, paid when the plan changed. Numbered oldest first (new changes go on top).
    const upgrades: Payment[] = s.changes.flatMap((c, k) => c.kind !== 'upgrade' ? [] : [{
      id: `PAY-${s.id.slice(4)}U${s.changes.length - k}`, kind: 'plan' as const, reference: `${c.toPlan} plan`, item: `Upgrade from ${c.fromPlan}`,
      detail: `Difference · ${PAYMENT_METHODS[c.method!]}`, customer, amountPaise: c.paidPaise, status: 'paid' as const, at: c.at, refundable: false,
    }]);
    return [...link, ...upgrades, ...paid];
  });
  return [...fromBookings, ...fromPlans].sort((a, b) => b.at.localeCompare(a.at));
}

const TABS: Record<PaymentTab, PaymentState[]> = {
  all: [], due: ['due'], waiting: ['link_sent', 'expired'], paid: ['paid'], failed: ['failed'], refunded: ['refunded'],
};

/** Money still open (balances due, links waiting) shows whatever the period, the same as the stats. */
const OPEN: PaymentState[] = ['due', 'link_sent'];

function inPeriod(p: Payment, from: string, to: string): boolean {
  if (OPEN.includes(p.status)) return true;
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
  const waiting = inRange.filter(p => p.status === 'link_sent');
  const due = inRange.filter(p => p.status === 'due');
  const refunded = inRange.filter(p => p.status === 'refunded');
  return {
    collectedPaise: sum(paid), collectedCount: paid.length, waitingPaise: sum(waiting), waitingCount: waiting.length,
    duePaise: sum(due), dueCount: due.length,
    failedCount: inRange.filter(p => p.status === 'failed').length, refundedPaise: sum(refunded), refundedCount: refunded.length,
  };
}

/** Refunds one booking payment in full, the same way it came in. The booking itself stays as it is; cancel it separately if needed. */
function refund(id: string, by: string): Payment {
  const b = db().bookings.find(x => x.payments.some(p => p.id === id));
  const entry = b?.payments.find(p => p.id === id);
  if (!b || !entry || entry.kind === 'refund') throw new MockError(404, 'Payment not found, or it can’t be refunded here.');
  if (b.payments.some(r => r.refundOf === id)) throw new MockError(409, 'This payment has already been refunded.');
  const back = addPayment(b, 'refund', entry.amountPaise, entry.method, by, entry.id);
  b.activity.unshift({ at: back.at, kind: 'payment', title: 'Payment refunded', detail: `${formatInr(entry.amountPaise)} · ${PAYMENT_METHODS[entry.method]}`, by });
  save();
  return allPayments().find(p => p.id === back.id)!;
}
