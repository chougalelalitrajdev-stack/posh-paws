import { HttpErrorResponse, HttpInterceptorFn, HttpRequest, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, catchError, from, map, mergeMap, tap, throwError, timer } from 'rxjs';
import { environment } from '../../../environments/environment';
import { WeekBoard } from '../models/calendar.model';
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

/** Areas the real backend serves (environment.liveApi): those requests go straight through to it. */
const isLive = (url: string) => environment.liveApi.some(area => url.slice(ADMIN_API.length).startsWith(area));

export const mockInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(ADMIN_API)) return next(req);
  if (isLive(req.url)) return next(req).pipe(tap(event => event instanceof HttpResponse && mirrorLive(req.url.slice(ADMIN_API.length), event.body)));
  const alert = inject(AlertService);
  return timer(LATENCY_MS).pipe(
    mergeMap(() => respond(req)),
    tap(res => warnWhenStorageFills(req, res, alert)),
  );
};

/**
 * Screens still on demo data (slots, bookings, the Day board) work from the demo copy of the settings.
 * While settings are live, each real settings reply is copied in, so those screens follow the real hours and holidays.
 * Goes away when slots move to the backend (backend/PLAN.md, Module 5).
 */
function mirrorLive(path: string, body: unknown): void {
  if (!body || typeof body !== 'object') return;
  if (path.startsWith('/settings') && 'booking' in body) {
    const s = body as Settings;
    db().settings = { ...s, booking: { ...s.booking, closures: s.booking.closures.map(({ affectedBookings, ...c }) => c) } };
    save();
  } else if (path.startsWith('/slot-board/week') && 'days' in body) {
    for (const { slots, ...hours } of (body as WeekBoard).days) db().settings.booking.hours[hours.day] = hours;
    save();
  }
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
