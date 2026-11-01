import { CATALOG_EDIT_ROLES } from '../constants/app.constants';
import { Plan, PlanDraft } from '../models/plan.model';
import { MockError, MockRequest, NO_ROUTE, StoredPlan, db, requireRole, route, save } from './mock-db';

export function handlePlans(r: MockRequest): unknown {
  let m: string[] | null;
  if (r.method !== 'GET' && /^\/plans\b/.test(r.path)) requireRole(r, CATALOG_EDIT_ROLES);
  if ((m = route(r, 'GET', /^\/plans$/))) return db().plans.map(withCounts);
  if ((m = route(r, 'POST', /^\/plans$/))) return create(r.body);
  if ((m = route(r, 'PUT', /^\/plans\/([^/]+)$/))) return update(m[0], r.body);
  return NO_ROUTE;
}

function withCounts(p: StoredPlan): Plan {
  return { ...p, activeSubscribers: db().subscriptions.filter(s => s.planId === p.id && s.status === 'active').length };
}

function clean(body: PlanDraft, id?: string): PlanDraft {
  const name = body.name?.trim();
  if (!name) throw new MockError(400, 'Enter a plan name.');
  if (db().plans.some(p => p.id !== id && p.name.toLowerCase() === name.toLowerCase())) throw new MockError(409, 'Another plan already has this name.');
  if (!Number.isInteger(body.pricePaise) || body.pricePaise <= 0) throw new MockError(400, 'Enter a price in whole rupees.');
  if (body.sessionsPerPeriod !== null && (!Number.isInteger(body.sessionsPerPeriod) || body.sessionsPerPeriod < 1)) throw new MockError(400, 'Sessions must be 1 or more, or unlimited.');
  if (body.discountPercent < 0 || body.discountPercent > 90) throw new MockError(400, 'Discount must be between 0% and 90%.');
  const benefits = (body.benefits ?? []).map(b => ({ text: b.text?.trim() ?? '', included: !!b.included })).filter(b => b.text);
  return {
    name, tagline: body.tagline?.trim() ?? '', pricePaise: body.pricePaise, billing: body.billing, sessionsPerPeriod: body.sessionsPerPeriod,
    discountPercent: body.discountPercent, eligibleServiceIds: body.eligibleServiceIds ?? [], benefits, featured: !!body.featured, subscribable: !!body.subscribable,
  };
}

/** Only one plan carries the "Most popular" badge. */
function onlyOneFeatured(id: string): void {
  for (const p of db().plans) if (p.id !== id) p.featured = false;
}

function create(body: PlanDraft): Plan {
  const plan: StoredPlan = { id: `plan-${Date.now().toString(36)}`, ...clean(body) };
  db().plans.push(plan);
  if (plan.featured) onlyOneFeatured(plan.id);
  save();
  return withCounts(plan);
}

/** Saving changes the plan for new subscribers; current members pick it up at their next renewal. */
function update(id: string, body: PlanDraft): Plan {
  const plan = db().plans.find(p => p.id === id);
  if (!plan) throw new MockError(404, 'Plan not found.');
  Object.assign(plan, clean(body, id));
  if (plan.featured) onlyOneFeatured(plan.id);
  save();
  return withCounts(plan);
}
