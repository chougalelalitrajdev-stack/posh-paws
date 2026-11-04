import { HttpErrorResponse, HttpInterceptorFn, HttpRequest, HttpResponse } from '@angular/common/http';
import { Observable, mergeMap, of, throwError, timer } from 'rxjs';
import { environment } from '../../../environments/environment';
import { BillDiscount, Booking, BookingBill, BookingRequest, PaymentEntry, PaymentStatus, QuoteRequest, TimeSlot } from '../models/booking.model';
import { ServiceItem } from '../models/catalog.model';
import { Membership } from '../models/membership.model';
import { Pet, PetDraft } from '../models/pet.model';
import { NewUserProfile, User } from '../models/user.model';
import { minutesOfDay, slotStart, timeFromMinutes, toIsoDate } from '../utils/date.utils';
import { readJson, writeJson } from '../utils/storage.utils';
import { MOCK_OTP, OFFERS, PLANS, PLAN_RULES, SERVICES, SHOP } from './mock-data';

// ─────────────────────────────────────────────────────────────
//  TEMPORARY fake backend. While environment.useMocks is true it answers
//  every API call from localStorage, following the API contract in the
//  root CLAUDE.md. When the FastAPI endpoints are live, set useMocks to
//  false and delete this folder; no service or page changes.
// ─────────────────────────────────────────────────────────────

const LATENCY_MS = 400;
const KEYS = {
  users: 'pp_mock_users',
  bookings: 'pp_mock_bookings',
  pets: (userId: string) => `pp_mock_pets_${userId}`,
  subscriptions: 'pp_mock_subscriptions',
  offerUses: 'pp_mock_offer_uses',
};

// Salon hours and slot rules (the admin's Settings › Booking & availability).
const OPENS = 9 * 60;
const CLOSES = 19 * 60;
const BREAK = [14 * 60, 14 * 60 + 30] as const;
const STEP = 30;
/** Same-day slots must start at least this far from now. */
const LEAD_MINUTES = 60;
/** Share of 30-minute blocks pretended to be taken by other customers. */
const BUSY_SHARE = 0.25;

interface StoredBooking {
  ownerId: string;
  booking: Booking;
}

interface StoredSubscription {
  planId: string;
  sessionsUsed: number;
  renewsOn: string;
}

class MockError {
  constructor(readonly status: number, readonly detail: string) {}
}

export const mockInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(environment.apiUrl)) return next(req);
  return timer(LATENCY_MS).pipe(mergeMap(() => respond(req)));
};

function respond(req: HttpRequest<unknown>): Observable<HttpResponse<unknown>> {
  try {
    const body = route(req, req.url.slice(environment.apiUrl.length));
    return of(new HttpResponse({ status: 200, body, url: req.url }));
  } catch (e) {
    const { status, detail } = e instanceof MockError ? e : new MockError(500, 'Mock server error.');
    return throwError(() => new HttpErrorResponse({ status, error: { detail }, url: req.url }));
  }
}

function route(req: HttpRequest<any>, path: string): unknown {
  const { method, body } = req;
  const param = (name: string) => req.params.get(name) ?? '';
  let match: RegExpMatchArray | null;

  // Public
  if (method === 'POST' && path === '/auth/otp/send') return {};
  if (method === 'POST' && path === '/auth/otp/verify') return verifyOtp(body);
  if (method === 'POST' && path === '/auth/register') return register(body);
  if (method === 'GET' && path === '/services') return SERVICES;
  if (method === 'GET' && path === '/plans') return PLANS;
  if (method === 'GET' && path === '/shop') return SHOP;
  if (method === 'GET' && path === '/slots') return slotsFor(param('date'), serviceById(param('serviceId')).durationMinutes);

  // Logged in
  const user = currentUser(req);
  if (method === 'GET' && path === '/pets') return petsOf(user);
  if (method === 'POST' && path === '/pets') return createPet(user, body);
  if (method === 'PUT' && (match = path.match(/^\/pets\/([^/]+)$/))) return updatePet(user, match[1], body);
  if (method === 'GET' && path === '/subscriptions/current') return membershipOf(user);
  if (method === 'POST' && path === '/subscriptions') return subscribe(user, body.planId);
  if (method === 'GET' && path === '/bookings') return listBookings(user);
  if (method === 'POST' && path === '/bookings/quote') return quote(user, body);
  if (method === 'POST' && path === '/bookings') return createBooking(user, body);
  if (method === 'POST' && (match = path.match(/^\/bookings\/([^/]+)\/cancel$/))) return cancelBooking(user, match[1]);

  throw new MockError(404, 'Not found.');
}

// ── Auth ──────────────────────────────────────────────────────

const users = () => readJson<Record<string, User>>(KEYS.users, {});
const tokenFor = (user: User) => `mock-token:${user.phone}`;

function verifyOtp({ phone, code }: { phone: string; code: string }) {
  if (code !== MOCK_OTP) throw new MockError(400, 'That code is incorrect. Please try again.');
  const user = users()[phone];
  return user ? { status: 'authenticated', user, token: tokenFor(user) } : { status: 'new-user' };
}

function register({ phone, name, email }: { phone: string } & NewUserProfile) {
  const user: User = { id: `mock-${phone}`, phone, name, ...(email && { email }) };
  writeJson(KEYS.users, { ...users(), [phone]: user });
  return { user, token: tokenFor(user) };
}

function currentUser(req: HttpRequest<unknown>): User {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '') ?? '';
  const user = token.startsWith('mock-token:') ? users()[token.slice('mock-token:'.length)] : undefined;
  if (!user) throw new MockError(401, 'Please log in.');
  return user;
}

// ── Pets ──────────────────────────────────────────────────────

const petsOf = (user: User) => readJson<Pet[]>(KEYS.pets(user.id), []);

function createPet(user: User, draft: PetDraft): Pet {
  const pet: Pet = { ...draft, id: crypto.randomUUID() };
  writeJson(KEYS.pets(user.id), [...petsOf(user), pet]);
  return pet;
}

function updatePet(user: User, id: string, pet: Pet): Pet {
  if (!petsOf(user).some(p => p.id === id)) throw new MockError(404, 'Pet not found.');
  const saved = { ...pet, id };
  writeJson(KEYS.pets(user.id), petsOf(user).map(p => (p.id === id ? saved : p)));
  return saved;
}

// ── Bookings ──────────────────────────────────────────────────

const storedBookings = () => readJson<StoredBooking[]>(KEYS.bookings, []);

function serviceById(id: string): ServiceItem {
  const service = SERVICES.find(s => s.id === id);
  if (!service) throw new MockError(404, 'Service not found.');
  return service;
}

/** Stand-in for the shop: staff mark visits completed at checkout; this demo has no staff, so past visits read as completed. */
function listBookings(user: User): Booking[] {
  const now = new Date();
  return storedBookings()
    .filter(r => r.ownerId === user.id)
    .map(({ booking: b }) =>
      b.status === 'confirmed' && slotStart(b.date, b.time) < now ? { ...b, status: 'completed' as const } : b,
    );
}

function createBooking(user: User, req: BookingRequest): Booking {
  const service = serviceById(req.serviceId);
  const pet = petsOf(user).find(p => p.id === req.petId);
  if (!pet) throw new MockError(404, 'Pet not found.');
  const free = slotsFor(req.date, service.durationMinutes).some(s => s.time === req.time && s.available);
  if (!free) throw new MockError(409, 'Sorry, that time was just booked by someone else. Please pick another slot.');

  // The app pays the advance online before this call (dummy until a gateway is added), which confirms the booking.
  const bill = quote(user, req);
  const id = crypto.randomUUID();
  const payments: PaymentEntry[] = bill.advancePaise
    ? [{ id: `${id}-1`, kind: 'advance', amountPaise: bill.advancePaise, method: 'online', at: new Date().toISOString() }]
    : [];
  const booking = settle({
    id,
    serviceId: service.id, serviceName: service.name, serviceIcon: service.icon,
    petId: pet.id, petName: pet.name, petType: pet.type,
    date: req.date, time: req.time, durationMinutes: service.durationMinutes,
    bill, payments, paymentStatus: 'unpaid', offerCode: bill.discount?.kind === 'offer' ? req.offerCode?.trim().toUpperCase() : null,
    ...(req.notes && { notes: req.notes }),
    status: 'confirmed',
    createdAt: new Date().toISOString(),
  });
  // A plan session or an offer use is taken when the booking is confirmed.
  if (bill.discount?.kind === 'session') changeSessions(user, +1);
  if (booking.offerCode) writeJson(KEYS.offerUses, { ...offerUses(), [user.id]: [...(offerUses()[user.id] ?? []), booking.offerCode] });
  writeJson(KEYS.bookings, [...storedBookings(), { ownerId: user.id, booking }]);
  return booking;
}

/** Cancelling gives back a plan session or offer use; the advance is refunded only if it's early enough. */
function cancelBooking(user: User, id: string): Booking {
  const records = storedBookings();
  const record = records.find(r => r.ownerId === user.id && r.booking.id === id);
  if (!record) throw new MockError(404, 'Booking not found.');
  const b = record.booking;
  if (b.status !== 'confirmed' || slotStart(b.date, b.time) < new Date()) throw new MockError(409, 'This booking can’t be cancelled any more.');

  if (b.bill.discount?.kind === 'session') changeSessions(user, -1);
  if (b.offerCode) writeJson(KEYS.offerUses, { ...offerUses(), [user.id]: (offerUses()[user.id] ?? []).filter(c => c !== b.offerCode) });
  const hoursBefore = (slotStart(b.date, b.time).getTime() - Date.now()) / 3_600_000;
  const advance = b.payments.find(p => p.kind === 'advance');
  const refunds: PaymentEntry[] = advance && hoursBefore >= SHOP.freeCancellationHours
    ? [{ id: `${b.id}-${b.payments.length + 1}`, kind: 'refund', amountPaise: advance.amountPaise, method: advance.method, at: new Date().toISOString() }]
    : [];
  const cancelled = settle({ ...b, status: 'cancelled', payments: [...b.payments, ...refunds] });
  writeJson(KEYS.bookings, records.map(r => (r === record ? { ...r, booking: cancelled } : r)));
  return cancelled;
}

// ── The bill (root CLAUDE.md › Booking & payment rules) ───────

/** Price → at most one discount (a plan session, else the better of the member discount and the offer) → total and advance. */
function quote(user: User, req: QuoteRequest): BookingBill {
  const service = serviceById(req.serviceId);
  const price = service.pricePaise;
  const plan = membershipOf(user);
  const rules = plan?.status === 'active' ? PLAN_RULES[plan.planId] : undefined;
  let discount: BillDiscount | null = null;
  if (plan && rules?.eligibleServiceIds.includes(service.id) && plan.sessionsLeft !== 0) {
    // No count in the label: the bill is kept, and a count would go stale.
    discount = { kind: 'session', label: `${plan.planName} plan session`, amountPaise: price };
  } else {
    const member: BillDiscount | null = plan && rules?.discountPercent
      ? { kind: 'membership', label: `${plan.planName} member ${rules.discountPercent}% off`, amountPaise: Math.round((price * rules.discountPercent) / 100) }
      : null;
    const offer = req.offerCode?.trim() ? offerDiscount(user, service, req.offerCode) : null;
    discount = [member, offer].filter(d => d !== null).sort((a, b) => b.amountPaise - a.amountPaise)[0] ?? null;
  }
  const totalPaise = Math.max(0, price - (discount?.amountPaise ?? 0));
  return {
    servicePricePaise: price, discount, totalPaise,
    advancePaise: totalPaise ? Math.min(SHOP.advancePaise, totalPaise) : 0,
    paidPaise: 0, balancePaise: totalPaise,
  };
}

const offerUses = () => readJson<Record<string, string[]>>(KEYS.offerUses, {});

function offerDiscount(user: User, service: ServiceItem, code: string): BillDiscount {
  const clean = code.trim().toUpperCase();
  const offer = OFFERS.find(o => o.code === clean);
  if (!offer) throw new MockError(400, `There’s no offer with the code ${clean}.`);
  if (offer.serviceIds && !offer.serviceIds.includes(service.id)) throw new MockError(400, `${clean} doesn’t apply to ${service.name}.`);
  if (offerUses()[user.id]?.includes(clean)) throw new MockError(400, `You’ve already used ${clean}.`);
  const amount = offer.type === 'percent' ? Math.round((service.pricePaise * offer.value) / 100) : offer.value;
  return { kind: 'offer', label: `${clean} · ${offer.title}`, amountPaise: Math.min(amount, service.pricePaise) };
}

/** Paid = payments minus refunds; a cancelled booking owes nothing more. */
function settle(b: Booking): Booking {
  const paid = b.payments.reduce((sum, p) => sum + (p.kind === 'refund' ? -p.amountPaise : p.amountPaise), 0);
  const closed = b.status === 'cancelled' || b.status === 'no_show';
  const balance = closed ? 0 : Math.max(0, b.bill.totalPaise - paid);
  const refunded = b.payments.some(p => p.kind === 'refund') && paid <= 0;
  const paymentStatus: PaymentStatus = refunded ? 'refunded'
    : (balance === 0 && (paid > 0 || b.bill.totalPaise === 0)) ? 'paid'
    : paid > 0 ? 'part_paid' : 'unpaid';
  return { ...b, bill: { ...b.bill, paidPaise: paid, balancePaise: balance }, paymentStatus };
}

// ── Membership ────────────────────────────────────────────────

const subscriptions = () => readJson<Record<string, StoredSubscription>>(KEYS.subscriptions, {});

function membershipOf(user: User): Membership | null {
  const sub = subscriptions()[user.id];
  const plan = sub && PLANS.find(p => p.id === sub.planId);
  if (!sub || !plan) return null;
  const total = PLAN_RULES[plan.id].sessionsPerPeriod;
  return {
    planId: plan.id, planName: plan.name, pricePaise: plan.pricePaise, status: 'active',
    sessionsTotal: total, sessionsUsed: sub.sessionsUsed, sessionsLeft: total === null ? null : Math.max(0, total - sub.sessionsUsed),
    discountPercent: PLAN_RULES[plan.id].discountPercent, renewsOn: sub.renewsOn, nextPlanName: null,
  };
}

/** The app takes the first month's payment before this call (dummy until a gateway is added). Changing plans is done by staff. */
function subscribe(user: User, planId: string): Membership {
  const plan = PLANS.find(p => p.id === planId);
  if (!plan) throw new MockError(404, 'Plan not found.');
  const current = membershipOf(user);
  if (current) throw new MockError(409, `You’re on the ${current.planName} plan. To change it, call us and we’ll switch it for you.`);
  const renewsOn = toIsoDate(new Date(Date.now() + 30 * 86_400_000));
  writeJson(KEYS.subscriptions, { ...subscriptions(), [user.id]: { planId, sessionsUsed: 0, renewsOn } });
  return membershipOf(user)!;
}

function changeSessions(user: User, by: number): void {
  const sub = subscriptions()[user.id];
  if (sub) writeJson(KEYS.subscriptions, { ...subscriptions(), [user.id]: { ...sub, sessionsUsed: Math.max(0, sub.sessionsUsed + by) } });
}

// ── Slots ─────────────────────────────────────────────────────

/** Opening hours minus a stable pseudo-random set of busy blocks and any stored bookings. */
function slotsFor(date: string, durationMinutes: number): TimeSlot[] {
  const now = new Date();
  const today = toIsoDate(now);
  if (date < today) return [];
  const earliest = date === today ? now.getHours() * 60 + now.getMinutes() + LEAD_MINUTES : 0;

  const taken = storedBookings()
    .map(r => r.booking)
    .filter(b => b.date === date && b.status === 'confirmed')
    .map(b => [minutesOfDay(b.time), minutesOfDay(b.time) + b.durationMinutes] as const);

  const slots: TimeSlot[] = [];
  for (let start = OPENS; start + durationMinutes <= CLOSES; start += STEP) {
    const end = start + durationMinutes;
    const available =
      start >= earliest &&
      (end <= BREAK[0] || start >= BREAK[1]) &&
      !hasBusyBlock(date, start, end) &&
      !taken.some(([from, to]) => start < to && from < end);
    slots.push({ time: timeFromMinutes(start), available });
  }
  return slots;
}

function hasBusyBlock(date: string, start: number, end: number): boolean {
  for (let block = start; block < end; block += STEP) {
    if (hash(`${date}@${block}`) % 100 < BUSY_SHARE * 100) return true;
  }
  return false;
}

/** Small stable string hash (djb2), so a day always shows the same busy blocks. */
function hash(text: string): number {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) >>> 0;
  return h;
}
