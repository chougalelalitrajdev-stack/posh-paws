import { HttpClient, HttpErrorResponse, HttpHeaders, provideHttpClient, withInterceptors } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { API } from '../constants/api-endpoints';
import { Booking } from '../models/booking.model';
import { CalendarData, DayAvailability } from '../models/calendar.model';
import { Paged } from '../models/paged.model';
import { Payment, PaymentSummary } from '../models/payment.model';
import { Settings } from '../models/settings.model';
import { TeamMember } from '../models/staff-user.model';
import { MessageTemplate } from '../models/template.model';
import { addDays, today } from '../utils/date.utils';
import { resetDb } from './mock-db';
import { mockInterceptor } from './mock.interceptor';

const owner = new HttpHeaders({ Authorization: 'Bearer mock-staff:st-1' }); // Sanjay R., Super Admin
const admin = new HttpHeaders({ Authorization: 'Bearer mock-staff:st-2' }); // Meera K., Admin
const staff = new HttpHeaders({ Authorization: 'Bearer mock-staff:st-3' }); // Amit J., Staff

describe('mock settings, templates, payments and team', () => {
  let http: HttpClient;
  const get = <T>(url: string, params: Record<string, string | number> = {}, headers = admin) => firstValueFrom(http.get<T>(url, { headers, params }));
  const send = <T>(method: 'POST' | 'PUT' | 'DELETE', url: string, body: object = {}, headers = admin) =>
    firstValueFrom(http.request<T>(method, url, { headers, body }));
  const statusOf = (p: Promise<unknown>) => p.then(() => 200, (e: HttpErrorResponse) => e.status);
  const slotsOn = async (date: string, serviceId = 'dog-signature-bath') =>
    (await get<DayAvailability[]>(API.slots, { serviceId, from: date, days: 1 }))[0].slots;
  const booking = async (patch: (b: Settings['booking']) => void) => {
    const s = await get<Settings>(API.settings);
    patch(s.booking);
    return send<Settings>('PUT', `${API.settings}/booking`, s.booking);
  };

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 27, 8, 0)); // Tue 27 Oct 2026, 8 am
    resetDb();
    TestBed.configureTestingModule({ providers: [provideHttpClient(withInterceptors([mockInterceptor]))] });
    http = TestBed.inject(HttpClient);
  });

  afterEach(() => vi.useRealTimers());

  it('offers slots by the booking rules in Settings', async () => {
    const day = addDays(today(), 5); // Sunday
    expect((await slotsOn(day)).map(s => s.time).slice(0, 3)).toEqual(['09:00', '09:30', '10:00']);

    await booking(b => {
      b.slotStepMinutes = 60;
      b.hours[6] = { ...b.hours[6], opens: '10:00', closes: '17:00', breakFrom: null, breakTo: null };
    });
    const sunday = await slotsOn(day);
    expect(sunday.map(s => s.time).slice(0, 3)).toEqual(['10:00', '11:00', '12:00']);
    expect(sunday.find(s => s.time === '14:00')?.available).toBe(true); // no break on Sundays now

    await booking(b => (b.hours[6].open = false));
    expect(await slotsOn(day)).toEqual([]);

    await booking(b => (b.bookAheadDays = 3));
    expect((await slotsOn(addDays(today(), 4))).some(s => s.available)).toBe(false);
  });

  it('blocks closures on the calendar and counts the bookings on that day', async () => {
    const day = addDays(today(), 1);
    await send('POST', `${API.settings}/closures`, { date: day, name: 'Staff training', closesAt: '13:00' });
    const settings = await get<Settings>(API.settings);
    const closure = settings.booking.closures.find(c => c.date === day)!;
    expect(closure.name).toBe('Staff training');
    const slots = await slotsOn(day);
    expect(slots.find(s => s.time === '11:00')?.available).toBe(true);
    expect(slots.filter(s => s.time >= '13:00').every(s => !s.available)).toBe(true);

    const cal = await get<CalendarData>(API.calendar, { from: day, days: 1 });
    expect(cal.blocks.some(b => b.reason === 'Closed · Staff training' && b.time === '13:00')).toBe(true);
    expect(await statusOf(send('POST', `${API.settings}/closures`, { date: day, name: 'Again', closesAt: null }))).toBe(409);
  });

  it('uses the hold amount and link expiry from Settings › Payments', async () => {
    const s = await get<Settings>(API.settings);
    await send('PUT', `${API.settings}/payments`, { ...s.payments, slotHoldPaise: 20000, linkExpiryHours: 12 });
    await send('PUT', `${API.bookings}/PP-1051`, { customerId: 'c1', petId: 'p1', serviceId: 'dog-royal-package', date: addDays(today(), 1), time: '15:00' });
    const sent = await send<Booking>('POST', `${API.bookings}/PP-1051/payment-link`, { amountType: 'hold' });
    expect(sent.payment?.amountPaise).toBe(20000);
    expect(new Date(sent.payment!.expiresAt).getTime() - new Date(sent.payment!.sentAt).getTime()).toBe(12 * 3_600_000);
  });

  it('lets only Super Admin and Admin change settings, and validates them', async () => {
    const s = await get<Settings>(API.settings, {}, staff); // everyone can read
    expect(await statusOf(send('PUT', `${API.settings}/app`, s.app, staff))).toBe(403);
    expect(await statusOf(booking(b => (b.hours[0] = { ...b.hours[0], breakFrom: '20:00', breakTo: '20:30' })))).toBe(400);
    expect(await statusOf(send('PUT', `${API.settings}/business`, { ...s.business, name: '' }))).toBe(400);
    const saved = await send<Settings>('PUT', `${API.settings}/app`, { bookButtonText: 'Reserve', showPrices: false });
    expect(saved.app).toEqual({ bookButtonText: 'Reserve', showPrices: false });
  });

  it('checks template fields and sends changed text back for approval', async () => {
    const list = await get<MessageTemplate[]>(API.templates, {}, staff);
    const reminder = list.find(t => t.key === 'booking_reminder')!;
    expect(reminder.trigger).toBe('At 18:00 the day before');
    expect(await statusOf(send('PUT', `${API.templates}/booking_reminder`, { body: reminder.body, autoSend: true }, staff))).toBe(403);
    expect(await statusOf(send('PUT', `${API.templates}/booking_reminder`, { body: 'Hi {customer}!', autoSend: true }))).toBe(400);

    const saved = await send<MessageTemplate>('PUT', `${API.templates}/booking_reminder`, { body: 'See you tomorrow, {customer_name}!', autoSend: true });
    expect(saved).toMatchObject({ approval: 'pending', updatedBy: 'Meera K.' });
    const manual = await send<MessageTemplate>('PUT', `${API.templates}/payment_link`, { body: list[0].body, autoSend: true });
    expect(manual).toMatchObject({ autoSend: false, approval: 'approved' }); // staff send it by hand; unchanged text stays approved
  });

  it('lists payments by status and refunds as Super Admin only', async () => {
    const paid = await get<Paged<Payment>>(API.payments, { tab: 'paid', pageSize: 100 });
    expect(paid.items.length).toBeGreaterThan(0);
    expect(paid.items.every(p => p.status === 'paid')).toBe(true);
    const waiting = await get<Paged<Payment>>(API.payments, { tab: 'waiting', pageSize: 100 });
    expect(waiting.items.every(p => p.status === 'link_sent' || p.status === 'expired')).toBe(true);

    const target = paid.items.find(p => p.refundable)!;
    expect(await statusOf(send('POST', `${API.payments}/${target.id}/refund`))).toBe(403);
    const before = await get<PaymentSummary>(API.paymentSummary, { from: '', to: '' });
    const refunded = await send<Payment>('POST', `${API.payments}/${target.id}/refund`, {}, owner);
    expect(refunded.status).toBe('refunded');
    expect((await get<Booking>(`${API.bookings}/${target.reference}`)).paymentStatus).toBe('refunded');
    const after = await get<PaymentSummary>(API.paymentSummary, { from: '', to: '' });
    expect(after.refundedCount).toBe(before.refundedCount + 1);
    expect(await statusOf(send('POST', `${API.payments}/${target.id}/refund`, {}, owner))).toBe(409);
  });

  it('keeps the team safe: owner only, one Super Admin, invites can’t sign in yet', async () => {
    expect(await statusOf(get(API.team))).toBe(403); // Admin
    const team = await get<TeamMember[]>(API.team, {}, owner);
    expect(team.map(m => m.status)).toContain('invited');
    expect(await statusOf(send('PUT', `${API.team}/st-1`, { role: 'admin' }, owner))).toBe(409); // own role

    const invited = await send<TeamMember>('POST', API.team, { name: 'Ravi P.', email: 'Ravi@PoshPaws.in', role: 'staff' }, owner);
    expect(invited).toMatchObject({ email: 'ravi@poshpaws.in', status: 'invited' });
    expect(await statusOf(send('POST', API.auth.login, { email: 'ravi@poshpaws.in', password: 'pawsword' }))).toBe(401);

    await send('PUT', `${API.team}/st-2`, { role: 'staff' }, owner);
    expect(await statusOf(send('PUT', `${API.settings}/app`, { bookButtonText: 'Book', showPrices: true }))).toBe(403); // Meera is Staff now
    await send('DELETE', `${API.team}/st-3`, {}, owner);
    expect(await statusOf(get(API.bookings, {}, staff))).toBe(401); // removed: signed out
  });
});
