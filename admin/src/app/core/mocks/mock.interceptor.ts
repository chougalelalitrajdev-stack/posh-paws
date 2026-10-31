import { HttpErrorResponse, HttpInterceptorFn, HttpRequest, HttpResponse } from '@angular/common/http';
import { Observable, mergeMap, of, throwError, timer } from 'rxjs';
import { environment } from '../../../environments/environment';
import { StaffUser } from '../models/staff-user.model';
import { handleBookings } from './mock-bookings';
import { handleCustomers } from './mock-customers';
import { handleDashboard } from './mock-dashboard';
import { handlePets } from './mock-pets';
import { handleSearch } from './mock-search';
import { handleSubscriptions } from './mock-subscriptions';
import { MOCK_PASSWORD, STAFF } from './mock-data';
import { MockError, MockRequest, NO_ROUTE } from './mock-db';

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
const HANDLERS = [handleDashboard, handleBookings, handleCustomers, handlePets, handleSubscriptions, handleSearch];

export const mockInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(ADMIN_API)) return next(req);
  return timer(LATENCY_MS).pipe(mergeMap(() => respond(req)));
};

function respond(req: HttpRequest<unknown>): Observable<HttpResponse<unknown>> {
  try {
    const body = dispatch(req);
    return of(new HttpResponse({ status: 200, body: structuredClone(body), url: req.url }));
  } catch (e) {
    if (!(e instanceof MockError)) console.error('Mock server error', e);
    const { status, detail } = e instanceof MockError ? e : new MockError(500, 'Mock server error.');
    return throwError(() => new HttpErrorResponse({ status, error: { detail }, url: req.url }));
  }
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
  const user = STAFF.find(s => s.email === email);
  if (!user || password !== MOCK_PASSWORD) {
    throw new MockError(401, "That email and password don't match. Check them and try again, or reset your password.");
  }
  return { user, token: tokenFor(user) };
}

function currentStaff(req: HttpRequest<unknown>): StaffUser {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '') ?? '';
  const user = STAFF.find(s => tokenFor(s) === token);
  if (!user) throw new MockError(401, 'Please sign in.');
  return user;
}
