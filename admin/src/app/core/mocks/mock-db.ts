import { HttpRequest } from '@angular/common/http';
import { Booking } from '../models/booking.model';
import { TimeBlock } from '../models/calendar.model';
import { Customer } from '../models/customer.model';
import { Subscription } from '../models/subscription.model';
import { StaffUser } from '../models/staff-user.model';
import { today } from '../utils/date.utils';
import { readJson, writeJson } from '../utils/storage.utils';
import { seedBookings, seedCustomers, seedSubscriptions } from './mock-data';

// State of the fake backend, kept in localStorage so changes survive a reload.
// It is reseeded each new day, so the demo's "today" always looks like today.

const KEY = 'ppa_mock_db';
const VERSION = 3;

/** What the database stores for a customer. Plan and booking numbers are worked out when read. */
export type StoredCustomer = Pick<Customer, 'id' | 'name' | 'phone' | 'email' | 'area' | 'customerSince' | 'pets' | 'staffNote'>;

export interface MockDb {
  version: number;
  seededOn: string;
  nextId: number;
  customers: StoredCustomer[];
  bookings: Booking[];
  blocks: TimeBlock[];
  subscriptions: Subscription[];
}

let state: MockDb | null = null;

export function db(): MockDb {
  if (!state) {
    const stored = readJson<MockDb | null>(KEY, null);
    state = stored && stored.version === VERSION && stored.seededOn === today() ? stored : seed();
    save();
  }
  return state;
}

export function save(): void {
  if (state) writeJson(KEY, state);
}

/** Throw away all changes (used by tests). */
export function resetDb(): void {
  state = seed();
  save();
}

function seed(): MockDb {
  const customers = seedCustomers();
  return {
    version: VERSION, seededOn: today(), nextId: 1060, customers,
    bookings: seedBookings(customers), blocks: [], subscriptions: seedSubscriptions(customers),
  };
}

// ── Request plumbing shared by the handlers ───────────────────

/** An error response: `{ detail }` with an HTTP status, like FastAPI. */
export class MockError {
  constructor(readonly status: number, readonly detail: string) {}
}

/** What every handler receives. `staff` is the signed-in user (null on public routes). */
export interface MockRequest {
  method: string;
  /** Path after /api/admin, e.g. "/bookings/PP-1051/cancel". */
  path: string;
  body: any;
  param: (name: string) => string;
  staff: StaffUser | null;
  raw: HttpRequest<unknown>;
}

/** Returned by a handler when the route isn't one of its own. */
export const NO_ROUTE = Symbol('no-route');

/** Matches "/bookings/PP-1051/cancel" against /^\/bookings\/([^/]+)\/cancel$/ and returns the captures. */
export function route(r: MockRequest, method: string, pattern: RegExp): string[] | null {
  if (r.method !== method) return null;
  const m = r.path.match(pattern);
  return m ? m.slice(1) : null;
}

export function requireStaff(r: MockRequest): StaffUser {
  if (!r.staff) throw new MockError(401, 'Please sign in.');
  return r.staff;
}
