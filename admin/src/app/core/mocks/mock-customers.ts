import { ActivityEntry } from '../models/booking.model';
import { Customer, CustomerDetails, CustomerPet, CustomerSegment, CustomerSummary, PaymentRecord, PetDraft } from '../models/customer.model';
import { Paged } from '../models/paged.model';
import { addDays, toIsoDate, today } from '../utils/date.utils';
import { SERVICES, STATIONS } from './mock-data';
import { MockError, MockRequest, NO_ROUTE, StoredCustomer, db, requireStaff, route, save } from './mock-db';
import { planOf } from './mock-subscriptions';

const LAPSED_DAYS = 90;
const SEGMENTS: CustomerSegment[] = ['all', 'members', 'new', 'lapsed', 'no_plan'];

/** Customers and their pets, plus the catalog lists (services, stations). */
export function handleCustomers(r: MockRequest): unknown {
  let m: string[] | null;

  if ((m = route(r, 'GET', /^\/services$/))) return SERVICES;
  if ((m = route(r, 'GET', /^\/stations$/))) return STATIONS;

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
  const spent = bookings.reduce((sum, b) => {
    if (b.stage === 'completed') return sum + (b.pricePaise ?? 0);
    if (b.paymentStatus === 'paid') return sum + (b.payment?.amountPaise ?? 0);
    return sum;
  }, 0);
  return {
    bookingsCount: bookings.filter(b => b.stage !== 'request' && b.stage !== 'draft').length,
    openRequests: bookings.filter(b => b.stage === 'request').length,
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
    : bookings.some(b => b.stage === 'request') ? { kind: 'request' }
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

export function cleanPet(body: PetDraft): PetDraft {
  const name = body.name?.trim();
  if (!name) throw new MockError(400, 'Enter the pet’s name.');
  if (body.type !== 'dog' && body.type !== 'cat') throw new MockError(400, 'Is it a dog or a cat?');
  const text = (v?: string) => v?.trim() || undefined;
  return {
    name, type: body.type,
    breed: text(body.breed), birthDate: body.birthDate || undefined, gender: body.gender || undefined,
    weightKg: body.weightKg ? Number(body.weightKg) : undefined, coat: text(body.coat), temperament: text(body.temperament),
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

function payments(c: StoredCustomer): PaymentRecord[] {
  const fromBookings: PaymentRecord[] = bookingsOf(c.id)
    .filter(b => b.payment)
    .map(b => ({
      id: `PAY-${b.id.slice(3)}`,
      kind: 'booking',
      reference: b.id,
      item: b.service?.name ?? 'Booking',
      amountPaise: b.stage === 'completed' ? b.pricePaise ?? b.payment!.amountPaise : b.payment!.amountPaise,
      status: b.paymentStatus === 'not_requested' ? 'link_sent' : b.paymentStatus,
      at: b.payment!.paidAt ?? b.payment!.sentAt,
    }));
  const month = new Intl.DateTimeFormat('en-IN', { month: 'short' });
  const fromPlans: PaymentRecord[] = db().subscriptions
    .filter(s => s.customer.id === c.id && s.status === 'active' && s.renewsOn)
    .flatMap(s => [1, 2].map(k => {
      const paidOn = addDays(s.renewsOn!, -30 * k);
      return {
        id: `PAY-${s.id.slice(4)}${k}`, kind: 'plan' as const, reference: `${s.planName} plan · ${month.format(new Date(paidOn))}`,
        item: 'Plan renewal', amountPaise: s.pricePaise, status: 'paid' as const, at: `${paidOn}T10:00:00`,
      };
    }).filter(p => p.at.slice(0, 10) >= s.startedOn));
  return [...fromBookings, ...fromPlans].sort((a, b) => b.at.localeCompare(a.at));
}

function activity(c: StoredCustomer): ActivityEntry[] {
  const fromBookings = bookingsOf(c.id).flatMap(b =>
    b.activity.map(a => ({ ...a, detail: [b.id, b.pet?.name, a.detail].filter(Boolean).join(' · ') })));
  const fromPlans: ActivityEntry[] = db().subscriptions
    .filter(s => s.customer.id === c.id)
    .flatMap(s => [
      { at: `${s.startedOn}T10:00:00`, kind: 'payment' as const, title: `Joined the ${s.planName} plan` },
      ...(s.endedOn ? [{ at: `${s.endedOn}T10:00:00`, kind: 'status' as const, title: `${s.planName} plan ${s.status === 'cancelled' ? 'cancelled' : 'expired'}` }] : []),
    ]);
  const joined: ActivityEntry = { at: c.customerSince, kind: 'request', title: 'Became a customer' };
  return [...fromBookings, ...fromPlans, joined].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 40);
}
