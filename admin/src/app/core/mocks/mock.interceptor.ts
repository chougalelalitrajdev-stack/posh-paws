import { HttpErrorResponse, HttpInterceptorFn, HttpRequest, HttpResponse } from '@angular/common/http';
import { Observable, mergeMap, of, throwError, timer } from 'rxjs';
import { environment } from '../../../environments/environment';
import { StaffUser } from '../models/staff-user.model';
import { MOCK_PASSWORD, STAFF } from './mock-data';

// ─────────────────────────────────────────────────────────────
//  TEMPORARY fake backend. While environment.useMocks is true it answers
//  every /admin API call, following the API contract in the root CLAUDE.md.
//  When the FastAPI endpoints are live, set useMocks to false and delete
//  this folder; no service or page changes.
// ─────────────────────────────────────────────────────────────

const LATENCY_MS = 400;
const ADMIN_API = `${environment.apiUrl}/admin`;

class MockError {
  constructor(readonly status: number, readonly detail: string) {}
}

export const mockInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(ADMIN_API)) return next(req);
  return timer(LATENCY_MS).pipe(mergeMap(() => respond(req)));
};

function respond(req: HttpRequest<unknown>): Observable<HttpResponse<unknown>> {
  try {
    const body = route(req, req.url.slice(ADMIN_API.length));
    return of(new HttpResponse({ status: 200, body, url: req.url }));
  } catch (e) {
    const { status, detail } = e instanceof MockError ? e : new MockError(500, 'Mock server error.');
    return throwError(() => new HttpErrorResponse({ status, error: { detail }, url: req.url }));
  }
}

function route(req: HttpRequest<any>, path: string): unknown {
  const { method, body } = req;

  // Public
  if (method === 'POST' && path === '/auth/login') return login(body);
  if (method === 'POST' && path === '/auth/forgot-password') return {};

  // Signed in (every later phase adds its routes below this line)
  currentStaff(req);

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
