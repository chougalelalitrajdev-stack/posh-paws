import { HttpErrorResponse, HttpInterceptorFn, HttpRequest, HttpResponse } from '@angular/common/http';
import { Observable, mergeMap, of, throwError, timer } from 'rxjs';
import { environment } from '../../../environments/environment';
import { BOOKING_DEPOSIT_PAISE } from '../constants/app.constants';
import { Booking, BookingRequest, TimeSlot } from '../models/booking.model';
import { ServiceItem } from '../models/catalog.model';
import { Pet, PetDraft } from '../models/pet.model';
import { NewUserProfile, User } from '../models/user.model';
import { minutesOfDay, slotStart, timeFromMinutes, toIsoDate } from '../utils/date.utils';
import { readJson, writeJson } from '../utils/storage.utils';
import { MOCK_OTP, PLANS, SERVICES } from './mock-data';

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
};

// Salon hours and slot rules.
const OPENS = 9 * 60;
const CLOSES = 19 * 60;
const STEP = 30;
/** Same-day slots must start at least this far from now. */
const LEAD_MINUTES = 60;
/** Share of 30-minute blocks pretended to be taken by other customers. */
const BUSY_SHARE = 0.25;

interface StoredBooking {
  ownerId: string;
  booking: Booking;
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
  if (method === 'GET' && path === '/slots') return slotsFor(param('date'), serviceById(param('serviceId')).durationMinutes);

  // Logged in
  const user = currentUser(req);
  if (method === 'GET' && path === '/pets') return petsOf(user);
  if (method === 'POST' && path === '/pets') return createPet(user, body);
  if (method === 'PUT' && (match = path.match(/^\/pets\/([^/]+)$/))) return updatePet(user, match[1], body);
  if (method === 'GET' && path === '/bookings') return listBookings(user);
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

  const booking: Booking = {
    id: crypto.randomUUID(),
    serviceId: service.id, serviceName: service.name, serviceIcon: service.icon,
    petId: pet.id, petName: pet.name, petType: pet.type,
    date: req.date, time: req.time, durationMinutes: service.durationMinutes,
    pricePaise: service.pricePaise, depositPaise: BOOKING_DEPOSIT_PAISE,
    ...(req.notes && { notes: req.notes }),
    status: 'confirmed',
    createdAt: new Date().toISOString(),
  };
  writeJson(KEYS.bookings, [...storedBookings(), { ownerId: user.id, booking }]);
  return booking;
}

function cancelBooking(user: User, id: string): Booking {
  const records = storedBookings();
  const record = records.find(r => r.ownerId === user.id && r.booking.id === id);
  if (!record) throw new MockError(404, 'Booking not found.');
  const cancelled: Booking = { ...record.booking, status: 'cancelled' };
  writeJson(KEYS.bookings, records.map(r => (r === record ? { ...r, booking: cancelled } : r)));
  return cancelled;
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
