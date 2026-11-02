import { HttpClient, HttpErrorResponse, HttpHeaders, provideHttpClient, withInterceptors } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { API } from '../constants/api-endpoints';
import { Booking, BookingBill, TimeSlot } from '../models/booking.model';
import { PlanItem, ServiceItem } from '../models/catalog.model';
import { Membership } from '../models/membership.model';
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
    expect(booking).toMatchObject({
      petName: 'Bruno', serviceName: 'Signature Bath', status: 'confirmed', paymentStatus: 'part_paid',
      bill: { totalPaise: 120000, advancePaise: 10000, paidPaise: 10000, balancePaise: 110000 },
    });

    expect(await statusOf(firstValueFrom(http.post(API.bookings, request, { headers })))).toBe(409);

    // Cancelled days ahead: the advance comes back.
    const cancelled = await firstValueFrom(http.post<Booking>(`${API.bookings}/${booking.id}/cancel`, {}, { headers }));
    expect(cancelled).toMatchObject({ status: 'cancelled', paymentStatus: 'refunded', bill: { paidPaise: 0, balancePaise: 0 } });
    expect((await slots(MONDAY)).find(s => s.time === free.time)!.available).toBe(true);
  }, 15000);

  describe('bills (root CLAUDE.md › Booking & payment rules)', () => {
    let headers: HttpHeaders;
    let petId: string;
    const post = <T>(url: string, body: object) => firstValueFrom(http.post<T>(url, body, { headers }));
    const quote = (serviceId: string, offerCode?: string) => post<BookingBill>(API.bookingQuote, { serviceId, offerCode });
    const book = async (serviceId: string, date: string) => {
      const time = (await slots(date, serviceId)).find(s => s.available)!.time;
      return post<Booking>(API.bookings, { serviceId, petId, date, time });
    };

    beforeEach(async () => {
      const { token } = await firstValueFrom(http.post<AuthResponse>(API.auth.register, { phone: '9876543210', name: 'Asha' }));
      headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
      petId = (await post<Pet>(API.pets, { type: 'dog', name: 'Bruno', temperament: [] })).id;
    });

    it('checks offer codes and uses the better of the member discount and the offer', async () => {
      expect(await quote('dog-signature-bath')).toMatchObject({ totalPaise: 120000, advancePaise: 10000, discount: null });
      expect(await statusOf(quote('dog-signature-bath', 'NOPE'))).toBe(400);
      expect(await statusOf(quote('cat-gentle-cat-bath', 'DIWALI20'))).toBe(400); // dogs only
      expect(await quote('dog-signature-bath', 'friend200')).toMatchObject({ totalPaise: 100000, discount: { kind: 'offer', amountPaise: 20000 } });

      await post<Membership>(API.subscriptions, { planId: 'posh' });
      expect(await statusOf(post(API.subscriptions, { planId: 'royal' }))).toBe(409); // staff change plans
      // The Royal Package isn't a Posh session: 10% off (₹450) beats FRIEND200 (₹200).
      expect(await quote('dog-royal-package', 'FRIEND200')).toMatchObject({ discount: { kind: 'membership', amountPaise: 45000 }, totalPaise: 405000 });
    });

    it('covers a plan service with a session (nothing to pay) and gives it back on cancel', async () => {
      await post<Membership>(API.subscriptions, { planId: 'posh' });
      expect(await quote('dog-signature-bath')).toMatchObject({ totalPaise: 0, advancePaise: 0, discount: { kind: 'session' } });
      const booking = await book('dog-signature-bath', MONDAY);
      expect(booking).toMatchObject({ paymentStatus: 'paid', payments: [], bill: { balancePaise: 0 } });
      const plan = () => firstValueFrom(http.get<Membership>(API.currentSubscription, { headers }));
      expect((await plan()).sessionsLeft).toBe(4);
      await post(`${API.bookings}/${booking.id}/cancel`, {});
      expect((await plan()).sessionsLeft).toBe(5);
    });

    it('keeps the advance when cancelled less than 24 hours before', async () => {
      const today = await book('dog-signature-bath', '2025-05-09');
      const cancelled = await post<Booking>(`${API.bookings}/${today.id}/cancel`, {});
      expect(cancelled).toMatchObject({ paymentStatus: 'paid', bill: { paidPaise: 10000, balancePaise: 0 } });
      expect(cancelled.payments.map(p => p.kind)).toEqual(['advance']);
    });
  });
});
