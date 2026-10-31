import { HttpClient, HttpErrorResponse, HttpHeaders, provideHttpClient, withInterceptors } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { API } from '../constants/api-endpoints';
import { Booking } from '../models/booking.model';
import { Customer, CustomerSummary } from '../models/customer.model';
import { Paged } from '../models/paged.model';
import { PetRecord } from '../models/pet.model';
import { SearchResults } from '../models/search.model';
import { Subscription, SubscriptionSummary } from '../models/subscription.model';
import { resetDb } from './mock-db';
import { mockInterceptor } from './mock.interceptor';

const headers = new HttpHeaders({ Authorization: 'Bearer mock-staff:st-3' }); // Amit J., Staff

describe('mock customers, pets, subscriptions and search', () => {
  let http: HttpClient;
  const get = <T>(url: string, params: Record<string, string | number> = {}) => firstValueFrom(http.get<T>(url, { headers, params }));
  const send = <T>(method: 'POST' | 'PUT', url: string, body: object = {}) => firstValueFrom(http.request<T>(method, url, { headers, body }));
  const statusOf = (p: Promise<unknown>) => p.then(() => 200, (e: HttpErrorResponse) => e.status);

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 27, 8, 0));
    resetDb();
    TestBed.configureTestingModule({ providers: [provideHttpClient(withInterceptors([mockInterceptor]))] });
    http = TestBed.inject(HttpClient);
  });

  afterEach(() => vi.useRealTimers());

  it('finds customers by segment, search text and plan', async () => {
    const members = await get<Paged<CustomerSummary>>(API.customers, { segment: 'members', pageSize: 50 });
    expect(members.items.every(c => c.planName)).toBe(true);
    const lapsed = await get<Paged<CustomerSummary>>(API.customers, { segment: 'lapsed', pageSize: 50 });
    expect(lapsed.items.map(c => c.name).sort()).toEqual(['Arjun Mehta', 'Karan Joshi']);
    const byPet = await get<Paged<CustomerSummary>>(API.customers, { q: 'coco' });
    expect(byPet.items.map(c => c.name)).toEqual(['Ananya Desai']);
    const byPhone = await get<Paged<CustomerSummary>>(API.customers, { q: '98220' });
    expect(byPhone.items[0].name).toBe('Ananya Desai');
  });

  it("takes a customer's plan and discount from their active subscription", async () => {
    const ananya = await get<Customer>(`${API.customers}/c1`);
    expect(ananya.plan).toMatchObject({ name: 'Posh', discountPercent: 10, sessionsLeft: 3, sessionsTotal: 5 });
    const isha = await get<Customer>(`${API.customers}/c8`); // payment pending: not a member yet
    expect(isha.plan).toBeNull();
  });

  it('rejects a duplicate phone and validates details', async () => {
    expect(await statusOf(send('POST', API.customers, { name: 'Copy', phone: '98220 41763' }))).toBe(409);
    expect(await statusOf(send('POST', API.customers, { name: '', phone: '9000000001' }))).toBe(400);
    const created = await send<Customer>('POST', API.customers, { name: 'New Person', phone: '90000 00001', email: 'new@example.com' });
    expect(created).toMatchObject({ phone: '9000000001', plan: null, bookingsCount: 0 });
  });

  it('edits a pet and keeps its name on bookings in step', async () => {
    await send('PUT', `${API.pets}/p1`, { name: 'Coco Bean', type: 'dog', breed: 'Shih Tzu', vaccination: 'due_soon' });
    const record = await get<PetRecord>(`${API.pets}/p1`);
    expect(record.pet).toMatchObject({ name: 'Coco Bean', vaccination: 'due_soon' });
    const booking = await get<Booking>(`${API.bookings}/PP-1051`);
    expect(booking.pet?.name).toBe('Coco Bean');
  });

  it('sends a renewal link and counts subscriptions by tab', async () => {
    const before = await get<SubscriptionSummary>(API.subscriptionSummary);
    expect(before.counts.pending).toBe(1);
    expect(before.renewingSoon).toBeGreaterThan(0);
    const sub = await send<Subscription>('POST', `${API.subscriptions}/SUB-101/payment-link`);
    expect(sub.paymentLink?.link).toContain('SUB-101');
    const after = await get<SubscriptionSummary>(API.subscriptionSummary);
    expect(after.needLink).toBe(before.needLink - 1);
    expect(await statusOf(send('POST', `${API.subscriptions}/SUB-109/payment-link`))).toBe(409); // expired
  });

  it('searches customers, pets and booking IDs', async () => {
    const byName = await get<SearchResults>(API.search, { q: 'bruno' });
    expect(byName.pets.map(p => p.name)).toContain('Bruno');
    expect(byName.customers.map(c => c.name)).toContain('Priya Sharma');
    const byId = await get<SearchResults>(API.search, { q: '1051' });
    expect(byId.bookings[0].id).toBe('PP-1051');
    expect((await get<SearchResults>(API.search, { q: 'b' })).customers).toEqual([]);
  });
});
