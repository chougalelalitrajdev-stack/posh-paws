import { ActivityEntry } from '../models/booking.model';
import { Customer, CustomerDetails, CustomerPet, CustomerSegment, CustomerSummary, PetDraft } from '../models/customer.model';
import { Payment } from '../models/payment.model';
import { Paged } from '../models/paged.model';
import { addDays, toIsoDate, today } from '../utils/date.utils';
import { MockError, MockRequest, NO_ROUTE, StoredCustomer, db, requireStaff, route, save } from './mock-db';
import { allPayments } from './mock-payments';
import { planChangeText, planOf } from './mock-subscriptions';

const LAPSED_DAYS = 90;
const SEGMENTS: CustomerSegment[] = ['all', 'members', 'new', 'lapsed', 'no_plan'];

/** Customers and their pets. */
export function handleCustomers(r: MockRequest): unknown {
  let m: string[] | null;

  if ((m = route(r, 'GET', /^\/customers$/))) return list(r);
  if ((m = route(r, 'GET', /^\/customers\/counts$/))) return Object.fromEntries(SEGMENTS.map(s => [s, db().customers.filter(c => inSegment(c, s)).length]));
  if ((m = route(r, 'GET', /^\/customers\/lookup$/))) {
    const phone = r.param('phone').replace(/\D/g, '').slice(-10);
    const found = db().customers.find(c => c.phone === phone);
    return found ? toCustomer(found) : null;
  }
  if ((m = route(r, 'POST', /^\/customers$/))) return create(r.body);
  if ((m = route(r, 'GET', /^\/customers\/([^/]+)$/))) return toCustomer(find(m[0]));
  if ((m = route(r, 'PUT', /^\/customers\/([^/]+)$/))) return update(find(m[0]), r.body);
  if ((m = route(r, 'PUT', /^\/customers\/([^/]+)\/note$/))) return saveNote(find(m[0]), r.body.text, requireStaff(r).name);
  if ((m = route(r, 'GET', /^\/customers\/([^/]+)\/payments$/))) return payments(find(m[0]));
  if ((m = route(r, 'GET', /^\/customers\/([^/]+)\/activity$/))) return activity(find(m[0]));
  if ((m = route(r, 'POST', /^\/customers\/([^/]+)\/pets$/))) return addPet(find(m[0]), r.body);
  return NO_ROUTE;
}

export function find(id: string): StoredCustomer {
  const c = db().customers.find(x => x.id === id);
  if (!c) throw new MockError(404, 'Customer not found.');
  return c;
}

// ── Worked out from bookings, like a database join ────────────

function bookingsOf(id: string) {
  return db().bookings.filter(b => b.customer.id === id);
}

function stats(c: StoredCustomer) {
  const bookings = bookingsOf(c.id);
  const completed = bookings.filter(b => b.stage === 'completed' && b.date).sort((a, b) => a.date!.localeCompare(b.date!));
  const last = completed.at(-1);
  // What they've actually paid: payments minus refunds, across all their bookings.
  const spent = bookings.reduce((sum, b) => sum + (b.bill?.paidPaise ?? 0), 0);
  return {
    bookingsCount: bookings.filter(b => b.stage !== 'draft').length,
    pastBookings: completed.length,
    spentPaise: spent,
    lastVisit: last ? { date: last.date!, serviceName: last.service?.name ?? '', petName: last.pet?.name ?? '' } : undefined,
  };
}

export function toCustomer(c: StoredCustomer): Customer {
  return { ...c, plan: planOf(c.id), staffNote: c.staffNote ?? null, ...stats(c) };
}

function summaryOf(c: StoredCustomer): CustomerSummary {
  const s = stats(c);
  const t = today();
  const bookings = bookingsOf(c.id);
  const upcoming = bookings
    .filter(b => (b.stage === 'confirmed' || b.stage === 'awaiting_payment') && b.date && b.date >= t)
    .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))[0];
  const next: CustomerSummary['next'] = upcoming
    ? { kind: 'booking', date: upcoming.date!, time: upcoming.time! }
    : bookings.some(b => b.stage === 'draft') ? { kind: 'draft' }
    : null;
  return {
    id: c.id, name: c.name, phone: c.phone, petNames: c.pets.map(p => p.name), planName: planOf(c.id)?.name ?? null,
    bookingsCount: s.bookingsCount, spentPaise: s.spentPaise, lastVisit: s.lastVisit?.date ?? null,
    lapsed: !!s.lastVisit && s.lastVisit.date < addDays(t, -LAPSED_DAYS), next,
  };
}

function inSegment(c: StoredCustomer, segment: CustomerSegment): boolean {
  switch (segment) {
    case 'members': return !!planOf(c.id);
    case 'new': return toIsoDate(new Date(c.customerSince)).slice(0, 7) === today().slice(0, 7);
    case 'lapsed': return summaryOf(c).lapsed;
    case 'no_plan': return !planOf(c.id);
    default: return true;
  }
}

function list(r: MockRequest): Paged<CustomerSummary> {
  const q = r.param('q').trim().toLowerCase();
  const digits = q.replace(/\D/g, '');
  const segment = (r.param('segment') || 'all') as CustomerSegment;
  const plan = r.param('plan');
  const petType = r.param('petType');
  const sort = r.param('sort') || 'last_visit';
  const page = Math.max(1, Number(r.param('page') || 1));
  const pageSize = Number(r.param('pageSize') || 10);

  const rows = db().customers
    .filter(c => !q || c.name.toLowerCase().includes(q) || (digits.length >= 3 && c.phone.includes(digits)) || c.pets.some(p => p.name.toLowerCase().includes(q)))
    .filter(c => inSegment(c, segment))
    .filter(c => !plan || (plan === 'none' ? !planOf(c.id) : planOf(c.id)?.name === plan))
    .filter(c => !petType || c.pets.some(p => p.type === petType))
    .map(summaryOf)
    .sort((a, b) =>
      sort === 'name' ? a.name.localeCompare(b.name)
      : sort === 'spent' ? b.spentPaise - a.spentPaise
      : (b.lastVisit ?? '').localeCompare(a.lastVisit ?? ''));
  return { items: rows.slice((page - 1) * pageSize, page * pageSize), total: rows.length, page, pageSize };
}

// ── Changes ───────────────────────────────────────────────────

function clean(body: CustomerDetails): CustomerDetails {
  const name = body.name?.trim();
  const phone = (body.phone ?? '').replace(/\D/g, '').slice(-10);
  if (!name) throw new MockError(400, 'Enter the customer’s name.');
  if (phone.length !== 10) throw new MockError(400, 'Enter a 10-digit mobile number.');
  const email = body.email?.trim();
  if (email && !/^\S+@\S+\.\S+$/.test(email)) throw new MockError(400, 'That email doesn’t look right.');
  return { name, phone, ...(email && { email }), ...(body.area?.trim() && { area: body.area.trim() }) };
}

function create(body: CustomerDetails): Customer {
  const details = clean(body);
  if (db().customers.some(c => c.phone === details.phone)) throw new MockError(409, 'A customer with this number already exists.');
  const customer: StoredCustomer = { id: `c${Date.now()}`, ...details, customerSince: new Date().toISOString(), pets: [] };
  db().customers.push(customer);
  save();
  return toCustomer(customer);
}

function update(c: StoredCustomer, body: CustomerDetails): Customer {
  const details = clean(body);
  if (db().customers.some(x => x.id !== c.id && x.phone === details.phone)) throw new MockError(409, 'Another customer already has this number.');
  Object.assign(c, { email: undefined, area: undefined }, details);
  // Keep the copies on bookings and subscriptions in step, as a real database join would.
  for (const b of db().bookings.filter(x => x.customer.id === c.id)) b.customer = { id: c.id, name: c.name, phone: c.phone };
  for (const s of db().subscriptions.filter(x => x.customer.id === c.id)) s.customer = { id: c.id, name: c.name, phone: c.phone };
  save();
  return toCustomer(c);
}

function saveNote(c: StoredCustomer, text: string, by: string): Customer {
  c.staffNote = text?.trim() ? { text: text.trim(), by, at: new Date().toISOString() } : null;
  save();
  return toCustomer(c);
}

/** Checks a pet as the server does: breed (from Catalog › Pet pricing), weight and coat are required, as they set the price. */
export function cleanPet(body: PetDraft, before?: CustomerPet): Omit<CustomerPet, 'id'> {
  const name = body.name?.trim();
  if (!name) throw new MockError(400, 'Enter the pet’s name.');
  if (body.type !== 'dog' && body.type !== 'cat') throw new MockError(400, 'Is it a dog or a cat?');
  if (!body.breedId) throw new MockError(400, 'Pick the breed.');
  const listed = db().petPricing[body.type].breeds.find(b => b.id === body.breedId);
  const kept = before?.breedId === body.breedId && before.type === body.type; // a breed taken off the list stays on the pet that has it
  if (!listed && !kept) throw new MockError(400, `Pick a ${body.type} breed from the list.`);
  const weightKg = Math.round(Number(body.weightKg) * 10) / 10;
  if (!(weightKg > 0 && weightKg <= 120)) throw new MockError(400, 'Enter a weight between 0.1 and 120 kg.');
  if (!body.coatType || !['single', 'double', 'triple'].includes(body.coatType)) throw new MockError(400, 'Pick the coat: single, double or triple.');
  const text = (v?: string) => v?.trim() || undefined;
  return {
    name, type: body.type, breedId: body.breedId, breed: listed?.name ?? before?.breed, weightKg, coatType: body.coatType,
    birthDate: body.birthDate || undefined, gender: body.gender || undefined, temperament: text(body.temperament),
    vaccination: body.vaccination || 'unknown', notes: text(body.notes), healthNotes: text(body.healthNotes),
  };
}

function addPet(c: StoredCustomer, body: PetDraft): CustomerPet {
  const pet: CustomerPet = { id: `p${Date.now()}`, ...cleanPet(body) };
  c.pets.push(pet);
  save();
  return pet;
}

// ── Payments and activity tabs ────────────────────────────────

function payments(c: StoredCustomer): Payment[] {
  return allPayments().filter(p => p.customer.id === c.id);
}

function activity(c: StoredCustomer): ActivityEntry[] {
  const fromBookings = bookingsOf(c.id).flatMap(b =>
    b.activity.map(a => ({ ...a, detail: [b.id, b.pet?.name, a.detail].filter(Boolean).join(' · ') })));
  const fromPlans: ActivityEntry[] = db().subscriptions
    .filter(s => s.customer.id === c.id)
    .flatMap(s => [
      { at: `${s.startedOn}T10:00:00`, kind: 'payment' as const, title: `Joined the ${s.changes.at(-1)?.fromPlan ?? s.planName} plan` },
      ...s.changes.map(ch => ({ at: ch.at, kind: 'status' as const, ...planChangeText(ch, s.renewsOn), by: ch.by })),
      ...(s.endedOn ? [{ at: `${s.endedOn}T10:00:00`, kind: 'status' as const, title: `${s.planName} plan ${s.status === 'cancelled' ? 'cancelled' : 'expired'}` }] : []),
    ]);
  const joined: ActivityEntry = { at: c.customerSince, kind: 'created', title: 'Became a customer' };
  return [...fromBookings, ...fromPlans, joined].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 40);
}
