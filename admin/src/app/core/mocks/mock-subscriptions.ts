import { PLAN_CHANGE_ROLES } from '../constants/app.constants';
import { PAYMENT_METHODS } from '../constants/status.constants';
import { CustomerPlan } from '../models/customer.model';
import { Paged } from '../models/paged.model';
import { PlanChange, PlanChangeRequest, PlanOption, Subscription, SubscriptionSummary, SubscriptionTab } from '../models/subscription.model';
import { addDays, shortDate, today } from '../utils/date.utils';
import { formatInr } from '../utils/money.utils';
import { MockError, MockRequest, NO_ROUTE, StoredPlan, db, requireRole, requireStaff, route, save } from './mock-db';

const RENEWING_DAYS = 7;

export function handleSubscriptions(r: MockRequest): unknown {
  let m: string[] | null;
  if ((m = route(r, 'GET', /^\/subscriptions$/))) return list((r.param('tab') || 'all') as SubscriptionTab, Number(r.param('page') || 1), Number(r.param('pageSize') || 10));
  if ((m = route(r, 'GET', /^\/subscriptions\/summary$/))) return subscriptionSummary();
  if ((m = route(r, 'POST', /^\/subscriptions\/([^/]+)\/payment-link$/))) return paymentLink(m[0]);
  if ((m = route(r, 'GET', /^\/subscriptions\/([^/]+)\/plan-options$/))) return planOptions(find(m[0]));
  if ((m = route(r, 'POST', /^\/subscriptions\/([^/]+)\/change-plan$/))) {
    requireRole(r, PLAN_CHANGE_ROLES);
    return changePlan(find(m[0]), r.body, requireStaff(r).name);
  }
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
    eligibleServiceIds: plan?.eligibleServiceIds ?? [],
    renewsOn: sub.renewsOn,
    nextPlanName: sub.nextPlan?.planName ?? null,
  };
}

function find(id: string): Subscription {
  const sub = db().subscriptions.find(s => s.id === id);
  if (!sub) throw new MockError(404, 'Subscription not found.');
  return sub;
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
  const sub = find(id);
  if (sub.status !== 'active' && sub.status !== 'payment_pending') throw new MockError(409, 'This plan has ended. Start a new subscription instead.');
  // Price changes reach current members at renewal: the link charges today's plan price.
  // A waiting downgrade is what they renew onto. The current period's sessions stay as they are.
  const next = sub.nextPlan && db().plans.find(p => p.id === sub.nextPlan!.planId);
  if (sub.nextPlan && next) Object.assign(sub.nextPlan, { planName: next.name, pricePaise: next.pricePaise });
  const plan = db().plans.find(p => p.id === sub.planId);
  if (!sub.nextPlan && plan) Object.assign(sub, { planName: plan.name, pricePaise: plan.pricePaise });
  sub.paymentLink = {
    link: `https://pay.poshpaws.in/s/${sub.id}-${Date.now().toString(36)}`, sentAt: new Date().toISOString(),
    amountPaise: sub.nextPlan?.pricePaise ?? sub.pricePaise, planName: sub.nextPlan?.planName ?? sub.planName,
  };
  save();
  return sub;
}

// ── Plan changes ──────────────────────────────────────────────

const sessionsLeft = (total: number | null, used: number) => (total === null ? null : Math.max(0, total - used));

/** What moving to `plan` would mean. An upgrade costs more than they paid for this period. */
function optionFor(sub: Subscription, plan: StoredPlan): PlanOption {
  const base = { planId: plan.id, name: plan.name, pricePaise: plan.pricePaise, sessionsPerPeriod: plan.sessionsPerPeriod, discountPercent: plan.discountPercent };
  const current = { sessionsLeft: sessionsLeft(sub.sessionsTotal, sub.sessionsUsed), payNowPaise: 0, startsOn: today() };
  if (plan.id === sub.planId) return { ...base, ...current, change: 'current' };
  if (sub.status === 'payment_pending') return { ...base, change: 'switch', payNowPaise: 0, startsOn: today(), sessionsLeft: plan.sessionsPerPeriod };
  if (plan.pricePaise > sub.pricePaise) {
    return { ...base, change: 'upgrade', payNowPaise: plan.pricePaise - sub.pricePaise, startsOn: today(), sessionsLeft: sessionsLeft(plan.sessionsPerPeriod, sub.sessionsUsed) };
  }
  return { ...base, ...current, change: 'downgrade', startsOn: sub.renewsOn ?? today() };
}

function planOptions(sub: Subscription): PlanOption[] {
  if (sub.status !== 'active' && sub.status !== 'payment_pending') throw new MockError(409, 'This plan has ended. Start a new subscription instead.');
  return db().plans.map(p => optionFor(sub, p));
}

function changePlan(sub: Subscription, body: PlanChangeRequest, by: string): Subscription {
  const options = planOptions(sub);
  const option = options.find(o => o.planId === body?.planId);
  const plan = db().plans.find(p => p.id === body?.planId);
  if (!option || !plan) throw new MockError(400, 'Pick a plan.');
  if (option.change === 'current' && !sub.nextPlan) throw new MockError(400, `They’re already on the ${plan.name} plan.`);
  if (option.change === 'upgrade' && !['upi_qr', 'cash', 'card'].includes(body.method ?? '')) {
    throw new MockError(400, `Choose how they paid the ${formatInr(option.payNowPaise)} difference.`);
  }

  const change: PlanChange = {
    at: new Date().toISOString(), kind: option.change === 'current' ? 'keep' : option.change, fromPlan: sub.planName, toPlan: plan.name,
    paidPaise: option.payNowPaise, method: option.change === 'upgrade' ? body.method! : null, by,
  };
  if (option.change === 'downgrade') {
    sub.nextPlan = { planId: plan.id, planName: plan.name, pricePaise: plan.pricePaise };
  } else if (option.change === 'current') {
    change.toPlan = sub.nextPlan!.planName;
    sub.nextPlan = null;
  } else {
    // Upgrade or switch: the new plan starts now. Sessions already used this period still count.
    Object.assign(sub, { planId: plan.id, planName: plan.name, pricePaise: plan.pricePaise, sessionsTotal: plan.sessionsPerPeriod, nextPlan: null });
  }
  // A link already sent charges the old plan; staff send a new one.
  sub.paymentLink = null;
  sub.changes = [change, ...sub.changes];
  save();
  return sub;
}

/** One line for activity lists. */
export function planChangeText(c: PlanChange, renewsOn: string | null): { title: string; detail: string } {
  switch (c.kind) {
    case 'upgrade': return { title: `Upgraded from ${c.fromPlan} to ${c.toPlan}`, detail: `${formatInr(c.paidPaise)} difference by ${PAYMENT_METHODS[c.method!]}` };
    case 'downgrade': return { title: `Moving from ${c.fromPlan} to ${c.toPlan}`, detail: `At renewal${renewsOn ? ` on ${shortDate(renewsOn)}` : ''}` };
    case 'switch': return { title: `Plan changed from ${c.fromPlan} to ${c.toPlan}`, detail: 'Before the first payment' };
    case 'keep': return { title: `Staying on ${c.fromPlan}`, detail: `The move to ${c.toPlan} was called off` };
  }
}
