import { HttpRequest } from '@angular/common/http';
import { Banner } from '../models/banner.model';
import { Booking } from '../models/booking.model';
import { TimeBlock } from '../models/calendar.model';
import { Service } from '../models/catalog.model';
import { Customer } from '../models/customer.model';
import { GalleryCategory, GalleryPhoto } from '../models/gallery.model';
import { Offer } from '../models/offer.model';
import { Faq, FaqGroup, SitePage } from '../models/page.model';
import { Closure, Settings } from '../models/settings.model';
import { MessageTemplate } from '../models/template.model';
import { Plan } from '../models/plan.model';
import { Subscription } from '../models/subscription.model';
import { StaffRole, StaffUser, TeamMember } from '../models/staff-user.model';
import { today } from '../utils/date.utils';
import { readJson } from '../utils/storage.utils';
import {
  FAQS, FAQ_GROUPS, GALLERY_CATEGORIES, PLANS, SERVICES, SETTINGS, seedBanners, seedBookings, seedClosures, seedCustomers, seedGallery, seedOffers,
  seedPages, seedSubscriptions, seedTeam, seedTemplates,
} from './mock-data';

// State of the fake backend, kept in localStorage so changes survive a reload.
// It is reseeded each new day, so the demo's "today" always looks like today.

const KEY = 'ppa_mock_db';
const VERSION = 6;

/** Browsers keep about 5 million characters per site; uploads are refused past this, so the demo keeps saving. */
export const STORAGE_LIMIT = 4_000_000;

/** What the database stores for a customer. Plan and booking numbers are worked out when read. */
export type StoredCustomer = Pick<Customer, 'id' | 'name' | 'phone' | 'email' | 'area' | 'customerSince' | 'pets' | 'staffNote'>;
export type StoredService = Omit<Service, 'upcomingBookings'>;
export type StoredPlan = Omit<Plan, 'activeSubscribers'>;
export type StoredBanner = Omit<Banner, 'status'>;
export type StoredCategory = Omit<GalleryCategory, 'photoCount'>;
export type StoredClosure = Omit<Closure, 'affectedBookings'>;
export type StoredSettings = Omit<Settings, 'booking'> & { booking: Omit<Settings['booking'], 'closures'> & { closures: StoredClosure[] } };
export type StoredTemplate = Omit<MessageTemplate, 'trigger'>;

export interface MockDb {
  version: number;
  seededOn: string;
  nextId: number;
  customers: StoredCustomer[];
  bookings: Booking[];
  blocks: TimeBlock[];
  subscriptions: Subscription[];
  services: StoredService[];
  plans: StoredPlan[];
  offers: Offer[];
  /** Content. Arrays are in display order. */
  banners: StoredBanner[];
  galleryCategories: StoredCategory[];
  gallery: GalleryPhoto[];
  pages: SitePage[];
  faqGroups: FaqGroup[];
  faqs: Faq[];
  /** Business: settings, message templates and the team (staff accounts). */
  settings: StoredSettings;
  templates: StoredTemplate[];
  staff: TeamMember[];
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
  if (!state) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    throw new MockError(507, 'The demo’s browser storage is full. Delete some photos, then try again.');
  }
}

/** Size of the demo database in characters (photos are most of it). */
export function storageUsed(): number {
  return JSON.stringify(db()).length;
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
    services: structuredClone(SERVICES), plans: structuredClone(PLANS), offers: seedOffers(),
    banners: seedBanners(), galleryCategories: structuredClone(GALLERY_CATEGORIES), gallery: seedGallery(), pages: seedPages(),
    faqGroups: structuredClone(FAQ_GROUPS), faqs: structuredClone(FAQS),
    settings: { ...structuredClone(SETTINGS), booking: { ...structuredClone(SETTINGS.booking), closures: seedClosures() } },
    templates: seedTemplates(), staff: seedTeam(),
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

/**
 * Puts the items named in `ids` back into the slots they already fill, in the order given.
 * Used to reorder one placement's banners, one category's photos or one group's FAQs inside a longer list.
 */
export function reorderSubset<T extends { id: string }>(all: T[], ids: string[]): T[] {
  const moved = ids.map(id => all.find(x => x.id === id));
  if (moved.some(x => !x) || new Set(ids).size !== ids.length) throw new MockError(400, 'The list changed. Reload and try again.');
  let i = 0;
  return all.map(x => (ids.includes(x.id) ? moved[i++]! : x));
}

export function requireStaff(r: MockRequest): StaffUser {
  if (!r.staff) throw new MockError(401, 'Please sign in.');
  return r.staff;
}

/** 403 unless the signed-in user has one of the roles. The UI hides these actions too, but the server decides. */
export function requireRole(r: MockRequest, roles: StaffRole[]): void {
  if (!roles.includes(requireStaff(r).role)) throw new MockError(403, 'Your role can’t make this change. Ask an Admin.');
}
