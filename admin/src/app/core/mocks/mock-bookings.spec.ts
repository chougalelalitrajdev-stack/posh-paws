import { HttpClient, HttpErrorResponse, HttpHeaders, provideHttpClient, withInterceptors } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { API } from '../constants/api-endpoints';
import { Booking, StageCounts } from '../models/booking.model';
import { DayAvailability } from '../models/calendar.model';
import { DashboardSummary } from '../models/dashboard.model';
import { Paged } from '../models/paged.model';
import { addDays, today } from '../utils/date.utils';
import { resetDb } from './mock-db';
import { mockInterceptor } from './mock.interceptor';

const headers = new HttpHeaders({ Authorization: 'Bearer mock-staff:st-2' }); // Meera K., Admin

describe('mock bookings API', () => {
  let http: HttpClient;
  const get = <T>(url: string, params: Record<string, string | number> = {}) => firstValueFrom(http.get<T>(url, { headers, params }));
  const post = <T>(url: string, body: object = {}) => firstValueFrom(http.post<T>(url, body, { headers }));
  const put = <T>(url: string, body: object) => firstValueFrom(http.put<T>(url, body, { headers }));
  const statusOf = (p: Promise<unknown>) => p.then(() => 200, (e: HttpErrorResponse) => e.status);
  const slotsOn = async (date: string, serviceId: string) =>
    (await get<DayAvailability[]>(API.slots, { serviceId, from: date, days: 1 }))[0].slots;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 27, 8, 0)); // Tue 27 Oct 2026, 8 am
    resetDb();
    TestBed.configureTestingModule({ providers: [provideHttpClient(withInterceptors([mockInterceptor]))] });
    http = TestBed.inject(HttpClient);
  });

  afterEach(() => vi.useRealTimers());

  it('rejects calls without a staff token', async () => {
    expect(await statusOf(firstValueFrom(http.get(API.bookings)))).toBe(401);
  });

  it('counts stages and filters the list', async () => {
    const counts = await get<StageCounts>(API.bookingCounts);
    expect(Object.keys(counts)).not.toContain('request'); // no callback requests: customers book in the app or staff book a call
    expect(counts.draft).toBe(1);
    const page = await get<Paged<Booking>>(API.bookings, { stage: 'confirmed', pageSize: 3 });
    expect(page.total).toBe(counts.confirmed);
    expect(page.items).toHaveLength(3);
    expect(page.items.every(b => b.stage === 'confirmed')).toBe(true);
  });

  it('keeps lunch blocked and leaves a buffer after appointments', async () => {
    const tomorrow = addDays(today(), 1);
    const slots = await slotsOn(tomorrow, 'dog-nail-trim-filing'); // 20 min
    expect(slots.find(s => s.time === '14:00')!.available).toBe(false); // lunch on both stations
    // Kaju is booked tomorrow 10:00–10:45 on Station 1; Station 2 is still free then.
    expect(slots.find(s => s.time === '10:00')!.available).toBe(true);
  });

  it('takes a phone call to a confirmed booking: details → payment link → advance taken at the shop', async () => {
    const date = addDays(today(), 1);
    const draft = await post<Booking>(API.bookings, { customerId: 'c1', petId: 'p1', serviceId: 'dog-royal-package', date, time: '15:00' });
    expect(draft).toMatchObject({ stage: 'draft', source: 'phone' });
    expect(draft.activity.at(-1)?.kind).toBe('created');
    // ₹4,500 less the 10% Posh discount (Royal Package isn't on the Posh plan, so no session); staff bookings take no advance.
    expect(draft.bill).toMatchObject({ servicePricePaise: 450000, totalPaise: 405000, advancePaise: 0, discount: { kind: 'membership' } });

    const sent = await post<Booking>(`${API.bookings}/${draft.id}/payment-link`, { amountType: 'hold' });
    expect(sent).toMatchObject({ stage: 'awaiting_payment', paymentStatus: 'link_sent' });
    expect(sent.paymentLink!.amountPaise).toBe(10000);
    expect(sent.stationId).toBeTruthy();

    const paid = await post<Booking>(`${API.bookings}/${draft.id}/payments`, { amountPaise: 10000, method: 'upi_qr' });
    expect(paid).toMatchObject({ stage: 'confirmed', paymentStatus: 'part_paid', paymentLink: null });
    expect(paid.bill).toMatchObject({ paidPaise: 10000, balancePaise: 395000 });
    expect(paid.activity[0].title).toBe('Payment taken at the shop');
    expect(paid.activity[0].by).toBe('Meera K.');
  });

  it('fills both stations, then answers 409 for a third booking at the same time', async () => {
    const date = addDays(today(), 5);
    const book = (customerId: string, petId: string) =>
      post<Booking>(API.bookings, { customerId, petId, serviceId: 'dog-signature-bath', date, time: '10:00' })
        .then(b => post<Booking>(`${API.bookings}/${b.id}/confirm`));

    const first = await book('c1', 'p1');
    const second = await book('c10', 'p12');
    expect(new Set([first.stationId, second.stationId]).size).toBe(2);
    expect((await slotsOn(date, 'dog-signature-bath')).find(s => s.time === '10:00')!.available).toBe(false);
    expect(await statusOf(book('c12', 'p14'))).toBe(409);
  });

  it('reschedules into a free slot, and refuses a slot that is taken', async () => {
    const day = addDays(today(), 2);
    const moved = await post<Booking>(`${API.bookings}/PP-1048/reschedule`, { date: day, time: '16:30' }); // Luna, was 12:00
    expect(moved.time).toBe('16:30');
    expect(moved.activity[0].title).toBe('Rescheduled');
    // A 2-hour groom at 13:00 runs into lunch on both stations.
    expect(await statusOf(post(`${API.bookings}/PP-1048/reschedule`, { date: day, time: '13:00' }))).toBe(409);
  });

  it('closes a visit only once it has started; checkout takes the balance and completes it', async () => {
    // PP-1045: Bruno's Royal Package today 11:30–14:00; the ₹100 advance was paid in the app. It's 8 am.
    const visit = `${API.bookings}/PP-1045`;
    expect(await statusOf(post(`${visit}/complete`))).toBe(409);
    expect(await statusOf(post(`${visit}/no-show`))).toBe(409);
    expect(await statusOf(post(`${visit}/payments`, { amountPaise: 10000, method: 'cash', complete: true }))).toBe(409);
    expect((await get<DashboardSummary>(API.dashboard)).attention.some(a => a.bookingId === 'PP-1045')).toBe(false);

    // 3 pm: the groom is over and nobody closed it, so Today asks.
    vi.setSystemTime(new Date(2026, 9, 27, 15, 0));
    const asked = (await get<DashboardSummary>(API.dashboard)).attention.find(a => a.bookingId === 'PP-1045');
    expect(asked).toMatchObject({ kind: 'visit', title: 'Did Bruno come in?' });
    expect(asked!.balancePaise).toBeGreaterThan(0);

    // Checkout: the balance by the shop QR, and the visit is done in the same step.
    const due = (await get<Booking>(visit)).bill!.balancePaise;
    const done = await post<Booking>(`${visit}/payments`, { amountPaise: due, method: 'upi_qr', complete: true });
    expect(done).toMatchObject({ stage: 'completed', paymentStatus: 'paid', bill: { balancePaise: 0 } });
    expect(done.activity.slice(0, 2).map(a => a.title)).toEqual(['Marked completed', 'Payment taken at the shop']);
    expect((await get<DashboardSummary>(API.dashboard)).attention.some(a => a.bookingId === 'PP-1045')).toBe(false);
  });
});
