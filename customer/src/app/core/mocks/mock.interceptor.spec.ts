import { HttpClient, HttpErrorResponse, HttpHeaders, provideHttpClient, withInterceptors } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { API } from '../constants/api-endpoints';
import { Booking, TimeSlot } from '../models/booking.model';
import { PlanItem, ServiceItem } from '../models/catalog.model';
import { Pet } from '../models/pet.model';
import { AuthResponse } from '../models/user.model';
import { mockInterceptor } from './mock.interceptor';

const NOW = new Date(2025, 4, 9, 10, 15); // Fri 9 May 2025, 10:15 am
const MONDAY = '2025-05-12';

describe('mockInterceptor (fake API)', () => {
  let http: HttpClient;

  const statusOf = (promise: Promise<unknown>) =>
    promise.then(() => 200, (e: HttpErrorResponse) => e.status);

  const slots = (date: string, serviceId = 'dog-signature-bath') =>
    firstValueFrom(http.get<TimeSlot[]>(API.slots, { params: { date, serviceId } }));

  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    TestBed.configureTestingModule({ providers: [provideHttpClient(withInterceptors([mockInterceptor]))] });
    http = TestBed.inject(HttpClient);
  });

  afterEach(() => vi.useRealTimers());

  it('serves services and plans priced in whole paise with unique ids', async () => {
    const services = await firstValueFrom(http.get<ServiceItem[]>(API.services));
    const plans = await firstValueFrom(http.get<PlanItem[]>(API.plans));
    const items = [...services, ...plans];
    expect(items.every(i => Number.isInteger(i.pricePaise) && i.pricePaise > 0)).toBe(true);
    expect(new Set(items.map(i => i.id)).size).toBe(items.length);
    expect(plans.filter(p => p.featured)).toHaveLength(1);
  });

  it('offers half-hourly slots that end by closing time, none in the past or inside the lead time', async () => {
    const royal = await slots(MONDAY, 'dog-royal-package'); // 150 min
    expect(royal[0].time).toBe('09:00');
    expect(royal.at(-1)!.time).toBe('16:30');
    expect(await slots('2025-05-08')).toEqual([]);
    const today = await slots('2025-05-09');
    expect(today.filter(s => s.time <= '11:00').every(s => !s.available)).toBe(true);
  });

  it('rejects a wrong code and protects pets behind login', async () => {
    const wrong = firstValueFrom(http.post(API.auth.verifyOtp, { phone: '9876543210', code: '000000' }));
    expect(await statusOf(wrong)).toBe(400);
    expect(await statusOf(firstValueFrom(http.get(API.pets)))).toBe(401);
  });

  it('books a free slot once, then answers 409 and frees it again on cancel', async () => {
    const { token } = await firstValueFrom(
      http.post<AuthResponse>(API.auth.register, { phone: '9876543210', name: 'Asha' }),
    );
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
    const pet = await firstValueFrom(http.post<Pet>(API.pets, { type: 'dog', name: 'Bruno', temperament: [] }, { headers }));

    const free = (await slots(MONDAY)).find(s => s.available)!;
    const request = { serviceId: 'dog-signature-bath', petId: pet.id, date: MONDAY, time: free.time };
    const booking = await firstValueFrom(http.post<Booking>(API.bookings, request, { headers }));
    expect(booking).toMatchObject({ petName: 'Bruno', serviceName: 'Signature Bath', status: 'confirmed', depositPaise: 10000 });

    expect(await statusOf(firstValueFrom(http.post(API.bookings, request, { headers })))).toBe(409);

    await firstValueFrom(http.post(`${API.bookings}/${booking.id}/cancel`, {}, { headers }));
    expect((await slots(MONDAY)).find(s => s.time === free.time)!.available).toBe(true);
  }, 15000);
});
