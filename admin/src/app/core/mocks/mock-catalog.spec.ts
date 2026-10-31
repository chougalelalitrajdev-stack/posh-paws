import { HttpClient, HttpErrorResponse, HttpHeaders, provideHttpClient, withInterceptors } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { API } from '../constants/api-endpoints';
import { Service } from '../models/catalog.model';
import { Offer, OfferDraft } from '../models/offer.model';
import { Plan } from '../models/plan.model';
import { Subscription } from '../models/subscription.model';
import { resetDb } from './mock-db';
import { mockInterceptor } from './mock.interceptor';

const admin = new HttpHeaders({ Authorization: 'Bearer mock-staff:st-2' }); // Meera K., Admin
const staff = new HttpHeaders({ Authorization: 'Bearer mock-staff:st-3' }); // Amit J., Staff

describe('mock services, plans and offers', () => {
  let http: HttpClient;
  const get = <T>(url: string) => firstValueFrom(http.get<T>(url, { headers: admin }));
  const send = <T>(method: 'POST' | 'PUT', url: string, body: object = {}, headers = admin) =>
    firstValueFrom(http.request<T>(method, url, { headers, body }));
  const statusOf = (p: Promise<unknown>) => p.then(() => 200, (e: HttpErrorResponse) => e.status);
  const draftOf = ({ id, used, status, paused, ...draft }: Offer): OfferDraft => draft;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 27, 8, 0));
    resetDb();
    TestBed.configureTestingModule({ providers: [provideHttpClient(withInterceptors([mockInterceptor]))] });
    http = TestBed.inject(HttpClient);
  });

  afterEach(() => vi.useRealTimers());

  it('lets staff read the catalog but not change it', async () => {
    expect((await get<Service[]>(API.services)).length).toBeGreaterThan(0);
    expect(await statusOf(send('POST', `${API.services}/dog-signature-bath/archive`, {}, staff))).toBe(403);
    expect(await statusOf(send('PUT', `${API.plans}/basic`, {}, staff))).toBe(403);
    expect(await statusOf(send('POST', `${API.offers}/off-1/pause`, {}, staff))).toBe(403);
  });

  it('reorders services and archives them out of the app', async () => {
    const dogs = (await get<Service[]>(API.services)).filter(s => s.petType === 'dog' && !s.archived);
    const ids = dogs.map(s => s.id).reverse();
    await send('PUT', `${API.services}/order`, { petType: 'dog', ids });
    const after = (await get<Service[]>(API.services)).filter(s => s.petType === 'dog' && !s.archived);
    expect(after.map(s => s.id)).toEqual(ids);

    const archived = await send<Service>('POST', `${API.services}/${ids[0]}/archive`);
    expect(archived).toMatchObject({ archived: true, visible: false });
  });

  it('keeps one recommended plan and charges a new price from the next renewal', async () => {
    const plans = await get<Plan[]>(API.plans);
    const basic = plans.find(p => p.id === 'basic')!;
    const posh = plans.find(p => p.id === 'posh')!;
    expect(posh.activeSubscribers).toBeGreaterThan(0);

    await send('PUT', `${API.plans}/basic`, { ...basic, featured: true });
    const featured = (await get<Plan[]>(API.plans)).filter(p => p.featured).map(p => p.id);
    expect(featured).toEqual(['basic']);

    await send('PUT', `${API.plans}/posh`, { ...posh, pricePaise: 109900, sessionsPerPeriod: 4 });
    const sub = await send<Subscription>('POST', `${API.subscriptions}/SUB-101/payment-link`);
    expect(sub).toMatchObject({ pricePaise: 109900, sessionsTotal: 5 }); // this period keeps its 5 sessions
  });

  it('works out offer status and checks codes', async () => {
    const offers = await get<Offer[]>(API.offers);
    const status = Object.fromEntries(offers.map(o => [o.id, o.status]));
    expect(status).toMatchObject({ 'off-1': 'live', 'off-3': 'scheduled', 'off-4': 'expired', 'off-5': 'paused' });

    const diwali = offers.find(o => o.id === 'off-1')!;
    expect(await statusOf(send('POST', API.offers, { ...draftOf(diwali), code: 'diwali20' }))).toBe(409);
    expect(await statusOf(send('POST', API.offers, { ...draftOf(diwali), code: 'NO SPACES' }))).toBe(400);
    expect(await statusOf(send('POST', API.offers, { ...draftOf(diwali), code: null, discountType: 'percent', value: 120 }))).toBe(400);

    const created = await send<Offer>('POST', API.offers, { ...draftOf(diwali), title: 'Weekend', code: 'weekend10', draft: true });
    expect(created).toMatchObject({ code: 'WEEKEND10', status: 'draft' });
    expect(await statusOf(send('POST', `${API.offers}/${created.id}/pause`))).toBe(409);

    const paused = await send<Offer>('POST', `${API.offers}/off-1/pause`);
    expect(paused.status).toBe('paused');
  });
});
