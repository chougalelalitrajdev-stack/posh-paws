import { HttpClient, HttpErrorResponse, HttpHeaders, provideHttpClient, withInterceptors } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { API } from '../constants/api-endpoints';
import { Booking, StageCounts } from '../models/booking.model';
import { DayAvailability } from '../models/calendar.model';
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
    expect(counts.request).toBe(6);
    const page = await get<Paged<Booking>>(API.bookings, { stage: 'request', pageSize: 3 });
    expect(page.total).toBe(6);
    expect(page.items).toHaveLength(3);
    expect(page.items.every(b => b.stage === 'request')).toBe(true);
  });

  it('keeps lunch blocked and leaves a buffer after appointments', async () => {
    const tomorrow = addDays(today(), 1);
    const slots = await slotsOn(tomorrow, 'dog-nail-trim-filing'); // 20 min
    expect(slots.find(s => s.time === '14:00')!.available).toBe(false); // lunch on both stations
    // Kaju is booked tomorrow 10:00–10:45 on Station 1; Station 2 is still free then.
    expect(slots.find(s => s.time === '10:00')!.available).toBe(true);
  });

  it('turns a request into a confirmed booking: details → payment link → paid', async () => {
    const date = addDays(today(), 1);
    const draft = await put<Booking>(`${API.bookings}/PP-1051`, { customerId: 'c1', petId: 'p1', serviceId: 'dog-royal-package', date, time: '15:00' });
    expect(draft.stage).toBe('draft');
    expect(draft.pricePaise).toBe(405000); // ₹4,500 less the 10% Posh discount

    const sent = await post<Booking>(`${API.bookings}/PP-1051/payment-link`, { amountType: 'hold' });
    expect(sent).toMatchObject({ stage: 'awaiting_payment', paymentStatus: 'link_sent' });
    expect(sent.payment!.amountPaise).toBe(10000);
    expect(sent.stationId).toBeTruthy();

    const paid = await post<Booking>(`${API.bookings}/PP-1051/mark-paid`);
    expect(paid).toMatchObject({ stage: 'confirmed', paymentStatus: 'paid' });
    expect(paid.activity[0].title).toBe('Marked paid at the desk');
    expect(paid.activity[0].by).toBe('Meera K.');
  });

  it('fills both stations, then answers 409 for a third booking at the same time', async () => {
    const date = addDays(today(), 5);
    const book = (id: string, customerId: string, petId: string) =>
      put<Booking>(`${API.bookings}/${id}`, { customerId, petId, serviceId: 'dog-signature-bath', date, time: '10:00' })
        .then(() => post<Booking>(`${API.bookings}/${id}/payment-link`, { amountType: 'full' }));

    const first = await book('PP-1051', 'c1', 'p1');
    const second = await book('PP-1050', 'c10', 'p12');
    expect(new Set([first.stationId, second.stationId]).size).toBe(2);
    expect((await slotsOn(date, 'dog-signature-bath')).find(s => s.time === '10:00')!.available).toBe(false);
    expect(await statusOf(book('PP-1053', 'c12', 'p14'))).toBe(409);
  });

  it('reschedules into a free slot, and refuses a slot that is taken', async () => {
    const day = addDays(today(), 2);
    const moved = await post<Booking>(`${API.bookings}/PP-1048/reschedule`, { date: day, time: '16:30' }); // Luna, was 12:00
    expect(moved.time).toBe('16:30');
    expect(moved.activity[0].title).toBe('Rescheduled');
    // A 2-hour groom at 13:00 runs into lunch on both stations.
    expect(await statusOf(post(`${API.bookings}/PP-1048/reschedule`, { date: day, time: '13:00' }))).toBe(409);
  });
});
