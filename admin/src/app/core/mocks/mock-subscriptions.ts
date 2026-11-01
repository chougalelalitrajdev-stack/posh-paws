import { CustomerPlan } from '../models/customer.model';
import { Paged } from '../models/paged.model';
import { Subscription, SubscriptionSummary, SubscriptionTab } from '../models/subscription.model';
import { addDays, today } from '../utils/date.utils';
import { MockError, MockRequest, NO_ROUTE, db, route, save } from './mock-db';

const RENEWING_DAYS = 7;

export function handleSubscriptions(r: MockRequest): unknown {
  let m: string[] | null;
  if ((m = route(r, 'GET', /^\/subscriptions$/))) return list((r.param('tab') || 'all') as SubscriptionTab, Number(r.param('page') || 1), Number(r.param('pageSize') || 10));
  if ((m = route(r, 'GET', /^\/subscriptions\/summary$/))) return subscriptionSummary();
  if ((m = route(r, 'POST', /^\/subscriptions\/([^/]+)\/payment-link$/))) return paymentLink(m[0]);
  return NO_ROUTE;
}

/** The customer's active plan, as booking pricing and the profile need it. */
export function planOf(customerId: string): CustomerPlan | null {
  const sub = db().subscriptions.find(s => s.customer.id === customerId && s.status === 'active');
  if (!sub) return null;
  const plan = db().plans.find(p => p.id === sub.planId);
  return {
    subscriptionId: sub.id,
    name: plan?.name ?? sub.planName,
    discountPercent: plan?.discountPercent ?? 0,
    pricePaise: sub.pricePaise,
    sessionsLeft: sub.sessionsTotal === null ? null : Math.max(0, sub.sessionsTotal - sub.sessionsUsed),
    sessionsTotal: sub.sessionsTotal,
    renewsOn: sub.renewsOn,
  };
}

function isRenewing(s: Subscription): boolean {
  return s.status === 'active' && !!s.renewsOn && s.renewsOn <= addDays(today(), RENEWING_DAYS);
}

function inTab(s: Subscription, tab: SubscriptionTab): boolean {
  switch (tab) {
    case 'active': return s.status === 'active';
    case 'renewing': return isRenewing(s);
    case 'pending': return s.status === 'payment_pending';
    case 'ended': return s.status === 'expired' || s.status === 'cancelled';
    default: return true;
  }
}

function list(tab: SubscriptionTab, page: number, pageSize: number): Paged<Subscription> {
  // Things to act on first: renewing soon, then pending, then the rest by renewal date.
  const rank = (s: Subscription) => (isRenewing(s) ? 0 : s.status === 'payment_pending' ? 1 : s.status === 'active' ? 2 : 3);
  const items = db().subscriptions
    .filter(s => inTab(s, tab))
    .sort((a, b) => rank(a) - rank(b) || (a.renewsOn ?? a.endedOn ?? '').localeCompare(b.renewsOn ?? b.endedOn ?? ''));
  return { items: items.slice((page - 1) * pageSize, page * pageSize), total: items.length, page, pageSize };
}

export function subscriptionSummary(): SubscriptionSummary {
  const subs = db().subscriptions;
  const active = subs.filter(s => s.status === 'active');
  const month = today().slice(0, 7);
  const endedThisMonth = subs.filter(s => s.endedOn?.startsWith(month));
  const tabs: SubscriptionTab[] = ['all', 'active', 'renewing', 'pending', 'ended'];
  return {
    active: active.length,
    byPlan: db().plans.map(p => ({ name: p.name, count: active.filter(s => s.planId === p.id).length })),
    monthlyPaise: active.reduce((sum, s) => sum + s.pricePaise, 0),
    renewingSoon: subs.filter(isRenewing).length,
    needLink: subs.filter(s => isRenewing(s) && !s.paymentLink).length,
    endedThisMonth: endedThisMonth.length,
    expiredThisMonth: endedThisMonth.filter(s => s.status === 'expired').length,
    cancelledThisMonth: endedThisMonth.filter(s => s.status === 'cancelled').length,
    counts: Object.fromEntries(tabs.map(t => [t, subs.filter(s => inTab(s, t)).length])) as Record<SubscriptionTab, number>,
  };
}

/** Renewal link for an active plan, or the first-payment link for a pending one. */
function paymentLink(id: string): Subscription {
  const sub = db().subscriptions.find(s => s.id === id);
  if (!sub) throw new MockError(404, 'Subscription not found.');
  if (sub.status !== 'active' && sub.status !== 'payment_pending') throw new MockError(409, 'This plan has ended. Start a new subscription instead.');
  // Plan changes reach current members at renewal: the link charges today's plan price.
  // The current period's sessions stay as they are; the new count starts when the renewal is paid.
  const plan = db().plans.find(p => p.id === sub.planId);
  if (plan) Object.assign(sub, { planName: plan.name, pricePaise: plan.pricePaise });
  sub.paymentLink = { link: `https://pay.poshpaws.in/s/${sub.id}-${Date.now().toString(36)}`, sentAt: new Date().toISOString() };
  save();
  return sub;
}
