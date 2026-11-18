import { HttpErrorResponse, HttpInterceptorFn, HttpRequest, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, catchError, from, map, mergeMap, tap, throwError, timer } from 'rxjs';
import { environment } from '../../../environments/environment';
import { WeekBoard } from '../models/calendar.model';
import { Customer, CustomerPet } from '../models/customer.model';
import { PetOwner } from '../models/pet.model';
import { Settings } from '../models/settings.model';
import { StaffUser } from '../models/staff-user.model';
import { AlertService } from '../services/alert.service';
import { handleBanners } from './mock-banners';
import { handleBookings } from './mock-bookings';
import { handleCatalog } from './mock-catalog';
import { handleOffers } from './mock-offers';
import { handlePlans } from './mock-plans';
import { handleCustomers } from './mock-customers';
import { handleDashboard } from './mock-dashboard';
import { handleGallery } from './mock-gallery';
import { handlePages } from './mock-pages';
import { handlePayments } from './mock-payments';
import { handleSettings } from './mock-settings';
import { handleTemplates } from './mock-templates';
import { handlePets } from './mock-pets';
import { handleSearch } from './mock-search';
import { handleSubscriptions } from './mock-subscriptions';
import { MOCK_PASSWORD } from './mock-data';
import { MockError, MockRequest, NO_ROUTE, STORAGE_LIMIT, db, save, storageUsed } from './mock-db';

// ─────────────────────────────────────────────────────────────
//  TEMPORARY fake backend. While environment.useMocks is true it answers
//  every /admin API call, following the API contract in the root CLAUDE.md.
//  One handler file per area (mock-bookings, mock-customers, ...); each phase
//  adds its own. When the FastAPI endpoints are live, set useMocks to false
//  and delete this folder; no service or page changes.
// ─────────────────────────────────────────────────────────────

const LATENCY_MS = 300;
const ADMIN_API = `${environment.apiUrl}/admin`;

/** Signed-in routes, tried in order. */
const HANDLERS = [
  handleDashboard, handleBookings, handleCustomers, handlePets, handleSubscriptions, handleSearch,
  handleCatalog, handlePlans, handleOffers, handleBanners, handleGallery, handlePages,
  handlePayments, handleTemplates, handleSettings,
];

/** A customer's Payments and Activity tabs are bookings and money: demo data until those modules are live (backend Modules 5–6). */
const STILL_DEMO = /^\/customers\/[^/]+\/(payments|activity)$/;

/** Areas the real backend serves (environment.liveApi): those requests go straight through to it. */
const isLive = (url: string) => {
  const path = url.slice(ADMIN_API.length);
  return !STILL_DEMO.test(path) && environment.liveApi.some(area => path.startsWith(area));
};

export const mockInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(ADMIN_API)) return next(req);
  if (isLive(req.url)) return next(req).pipe(tap(event => event instanceof HttpResponse && mirrorLive(req.url.slice(ADMIN_API.length), event.body)));
  const alert = inject(AlertService);
  return timer(LATENCY_MS).pipe(
    mergeMap(() => respond(req)),
    tap(res => warnWhenStorageFills(req, res, alert)),
  );
};

/** Catalog lists the demo bookings, memberships and prices read from their own copy (same ids as the backend's seed). */
const MIRRORED = ['services', 'stations', 'plans', 'offers'] as const;

/**
 * Screens still on demo data (slots, bookings, the Day board, bills, subscriptions) work from the demo copy of the settings, catalog
 * and customers. While those are live, each real reply is copied in, so those screens follow the real hours, holidays, services,
 * stations, plans, offers, customers and pets. Goes away when bookings, money and subscriptions move to the backend (backend/PLAN.md, Modules 5–7).
 */
function mirrorLive(path: string, body: unknown): void {
  if (!body || typeof body !== 'object') return;
  const list = MIRRORED.find(name => path.startsWith(`/${name}`));
  if (path.startsWith('/settings') && 'booking' in body) {
    const s = body as Settings;
    db().settings = { ...s, booking: { ...s.booking, closures: s.booking.closures.map(({ affectedBookings, ...c }) => c) } };
  } else if (path.startsWith('/slot-board/week') && 'days' in body) {
    for (const { slots, ...hours } of (body as WeekBoard).days) db().settings.booking.hours[hours.day] = hours;
  } else if (list) {
    // A whole list replaces the copy; one saved item replaces its old self (or is added).
    const lists = db() as unknown as Record<(typeof MIRRORED)[number], { id: string }[]>;
    if (Array.isArray(body)) lists[list] = body;
    else if ('id' in body) upsert(lists[list], body as { id: string });
    else return;
  } else if (!((path.startsWith('/customers') || path.startsWith('/pets')) && mirrorPeople(path, body))) {
    return;
  }
  save();
}

/** A customer reply (profile, lookup, add, edit, note) or a pet reply (add, edit, record) updates the demo's copy. */
function mirrorPeople(path: string, body: object): boolean {
  if ('phone' in body && 'pets' in body) {
    const { id, name, phone, email, area, customerSince, pets, staffNote } = body as Customer;
    upsert(db().customers, { id, name, phone, email, area, customerSince, pets, staffNote });
    return true;
  }
  const pet = ('pet' in body ? body.pet : body) as Partial<CustomerPet>;
  const ownerId = 'owner' in body ? (body.owner as PetOwner).id : path.match(/^\/customers\/([^/]+)\/pets$/)?.[1];
  const owner = db().customers.find(c => c.id === ownerId || c.pets.some(p => p.id === pet.id));
  if (!owner || !pet.id) return false;
  upsert(owner.pets, pet as CustomerPet);
  return true;
}

function upsert<T extends { id: string }>(items: T[], item: T): void {
  const i = items.findIndex(x => x.id === item.id);
  if (i < 0) items.push(item);
  else items[i] = item;
}

/** Uploaded photos live in browser storage while mocks are on; say so before it fills up. */
function warnWhenStorageFills(req: HttpRequest<unknown>, res: HttpResponse<unknown>, alert: AlertService): void {
  if (req.method !== 'POST' || !req.url.endsWith('/uploads')) return;
  const used = (storageUsed() + (res.body as { url: string }).url.length) / STORAGE_LIMIT;
  if (used > 0.75) alert.info(`Demo photo storage is ${Math.round(used * 100)}% full. Delete photos you don’t need. Real photo storage removes this limit.`);
}

/** Handlers may answer directly or with a Promise (uploads read the file first). */
function respond(req: HttpRequest<unknown>): Observable<HttpResponse<unknown>> {
  return from(Promise.resolve().then(() => dispatch(req))).pipe(
    map(body => new HttpResponse({ status: 200, body: structuredClone(body), url: req.url })),
    catchError(e => {
      if (!(e instanceof MockError)) console.error('Mock server error', e);
      const { status, detail } = e instanceof MockError ? e : new MockError(500, 'Mock server error.');
      return throwError(() => new HttpErrorResponse({ status, error: { detail }, url: req.url }));
    }),
  );
}

function dispatch(req: HttpRequest<unknown>): unknown {
  const r: MockRequest = {
    method: req.method,
    path: req.url.slice(ADMIN_API.length),
    body: req.body ?? {},
    param: name => req.params.get(name) ?? '',
    staff: null,
    raw: req,
  };

  // Public
  if (r.method === 'POST' && r.path === '/auth/login') return login(r.body);
  if (r.method === 'POST' && r.path === '/auth/forgot-password') return {};

  // Signed in
  r.staff = currentStaff(req);
  for (const handle of HANDLERS) {
    const result = handle(r);
    if (result !== NO_ROUTE) return result;
  }
  throw new MockError(404, 'Not found.');
}

// ── Auth ──────────────────────────────────────────────────────

const tokenFor = (user: StaffUser) => `mock-staff:${user.id}`;

function login({ email, password }: { email: string; password: string }) {
  const member = db().staff.find(s => s.email === email?.trim().toLowerCase() && s.status === 'active');
  if (!member || password !== MOCK_PASSWORD) {
    throw new MockError(401, "That email and password don't match. Check them and try again, or reset your password.");
  }
  member.lastSeenAt = new Date().toISOString();
  const { id, name, role } = member;
  return { user: { id, name, email: member.email, role }, token: tokenFor(member) };
}

function currentStaff(req: HttpRequest<unknown>): StaffUser {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '') ?? '';
  const user = db().staff.find(s => tokenFor(s) === token && s.status === 'active') ?? staffFromToken(token);
  if (!user) throw new MockError(401, 'Please sign in.');
  return user;
}

/**
 * Once sign-in is live, tokens come from the real backend (a JWT). Its middle part names the person and their role;
 * the backend checks the signature, and these demo screens simply trust it.
 */
function staffFromToken(token: string): StaffUser | null {
  const claims = token.split('.')[1];
  if (!claims) return null;
  try {
    const c = JSON.parse(atob(claims.replace(/-/g, '+').replace(/_/g, '/')));
    return c.sub && c.role ? { id: c.sub, name: c.name, email: c.email, role: c.role } : null;
  } catch {
    return null;
  }
}
