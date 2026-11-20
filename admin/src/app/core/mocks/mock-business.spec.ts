import { HttpClient, HttpErrorResponse, HttpHeaders, provideHttpClient, withInterceptors } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { API } from '../constants/api-endpoints';
import { Booking } from '../models/booking.model';
import { CalendarData, DayAvailability, SlotBoard, WeekBoard } from '../models/calendar.model';
import { Station } from '../models/catalog.model';
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

  it('lets any staff close usual start times and open extra ones on the slot board', async () => {
    const day = addDays(today(), 3);
    const setSlot = (time: string, open: boolean, date = day) => send<SlotBoard>('PUT', `${API.slotBoard}/${date}`, { time, open }, staff);
    const board = await get<SlotBoard>(API.slotBoard, { date: day });
    expect(board.slots[0]).toMatchObject({ time: '09:00', state: 'open', freeStations: 3, blockedBy: null }); // 2 tables + the cat corner
    expect(board.slots.find(s => s.time === '14:00')?.blockedBy).toBe('Break');

    // A closed time leaves the customer's list and can't be booked.
    await setSlot('10:00', false);
    expect((await slotsOn(day)).some(s => s.time === '10:00')).toBe(false);
    const arjun = { customerId: 'c7', petId: 'p9', serviceId: 'dog-signature-bath', date: day };
    expect(await statusOf(send('POST', API.bookings, { ...arjun, time: '10:00' }))).toBe(409);

    // Extra times ignore opening hours and the break: 19:30 is after closing, 14:00 is in the break.
    const late = await setSlot('19:30', true);
    expect(late.slots.at(-1)).toMatchObject({ time: '19:30', state: 'extra', freeStations: 3 });
    expect((await setSlot('14:00', true)).slots.find(s => s.time === '14:00')).toMatchObject({ state: 'extra', blockedBy: null });
    const open = await slotsOn(day);
    expect(open.find(s => s.time === '19:30')?.available).toBe(true);
    expect(open.find(s => s.time === '14:00')?.available).toBe(true);
    expect((await send<Booking>('POST', API.bookings, { ...arjun, time: '19:30' })).time).toBe('19:30');

    // Closing an extra time takes it back to how it was (14:00: break); opening a closed time brings it back.
    await setSlot('14:00', false);
    await setSlot('10:00', true);
    const back = await slotsOn(day);
    expect(back.find(s => s.time === '14:00')?.available).toBe(false);
    expect(back.find(s => s.time === '10:00')?.available).toBe(true);

    expect(await statusOf(setSlot('10:00', false, addDays(today(), -1)))).toBe(400); // past
    expect(await statusOf(setSlot('25:00', true))).toBe(400);
    expect(await statusOf(setSlot('11:10', false))).toBe(404); // not a start time
  });

  it('repeats start-time changes every week, lets one day override them, and a holiday beats both', async () => {
    const monday = addDays(today(), 6);
    const nextMonday = addDays(today(), 13);
    const saturday = addDays(today(), 4);
    // Seeded: 9:00 closed every Monday, an extra 19:00 every Saturday.
    const week = await get<WeekBoard>(API.weekBoard);
    expect(week.days[0].slots.find(s => s.time === '09:00')?.state).toBe('closed');
    expect(week.days[5].slots.find(s => s.time === '19:00')?.state).toBe('extra');
    expect(week.days[1].slots.find(s => s.time === '14:00')?.state).toBe('break');
    expect((await slotsOn(monday)).some(s => s.time === '09:00')).toBe(false);
    expect((await slotsOn(nextMonday)).some(s => s.time === '09:00')).toBe(false);
    expect((await slotsOn(saturday)).find(s => s.time === '19:00')?.available).toBe(true);

    // Only Admins change the usual week.
    expect(await statusOf(send('PUT', `${API.weekBoard}/1`, { time: '10:00', open: false }, staff))).toBe(403);
    await send('PUT', `${API.weekBoard}/1`, { time: '10:00', open: false });
    expect((await slotsOn(addDays(today(), 7))).some(s => s.time === '10:00')).toBe(false); // next Tuesday

    // One day wins over the week: staff reopen 9:00 on this Monday only.
    const reopened = await send<SlotBoard>('PUT', `${API.slotBoard}/${monday}`, { time: '09:00', open: true }, staff);
    expect(reopened.slots.find(s => s.time === '09:00')).toMatchObject({ state: 'open', weekly: 'closed' });
    expect((await slotsOn(monday)).some(s => s.time === '09:00')).toBe(true);
    expect((await slotsOn(nextMonday)).some(s => s.time === '09:00')).toBe(false);

    // A holiday beats the weekly extra time and the day's own openings; any staff member can add one.
    await send('POST', `${API.settings}/closures`, { date: monday, name: 'Staff training', closesAt: null }, staff);
    expect(await slotsOn(monday)).toEqual([]);
    await send('POST', `${API.settings}/closures`, { date: saturday, name: 'Diwali', closesAt: null }, staff);
    expect(await slotsOn(saturday)).toEqual([]);
  });

  it('books each service on a station that can do it, most specialised first, and lets Admins set up stations', async () => {
    const day = addDays(today(), 3);
    const stations = await get<Station[]>(API.stations);
    expect(stations.map(st => `${st.name}:${st.canDo}`)).toEqual(['Station 1:all', 'Station 2:all', 'Cat corner:cats']);
    const book = (customerId: string, petId: string, serviceId: string, time = '10:00') =>
      send<Booking>('POST', API.bookings, { customerId, petId, serviceId, date: day, time })
        .then(b => send<Booking>('POST', `${API.bookings}/${b.id}/confirm`));

    // A cat goes to the cat corner first, so both all-round tables are still free for dogs at 10:00.
    expect((await book('c5', 'p6', 'cat-gentle-cat-bath')).stationId).toBe('st3');
    expect((await book('c1', 'p1', 'dog-signature-bath')).stationId).toBe('st1');
    expect((await book('c10', 'p12', 'dog-signature-bath')).stationId).toBe('st2');
    expect((await slotsOn(day)).find(s => s.time === '10:00')?.available).toBe(false);
    expect((await slotsOn(day, 'cat-nail-trim-filing')).find(s => s.time === '10:00')?.available).toBe(false);

    // Switching a station off takes it out of new bookings; staff can't change stations.
    const freeAtNoon = async () => (await get<SlotBoard>(API.slotBoard, { date: day })).slots.find(s => s.time === '12:00')!.freeStations;
    expect(await freeAtNoon()).toBe(3);
    expect(await statusOf(send('PUT', `${API.stations}/st3`, { ...stations[2], active: false }, staff))).toBe(403);
    await send('PUT', `${API.stations}/st3`, { ...stations[2], active: false });
    expect(await freeAtNoon()).toBe(2);
    expect(await statusOf(send('PUT', `${API.stations}/st2`, { ...stations[1], canDo: 'some', serviceIds: [] }))).toBe(400);

    // A new station for nail trims only: a nail trim fits at 10:00 again, a bath doesn't.
    const quick = await send<Station>('POST', API.stations, { name: 'Quick station', active: true, canDo: 'some', serviceIds: ['dog-nail-trim-filing'] });
    expect(await freeAtNoon()).toBe(3);
    expect((await slotsOn(day, 'dog-nail-trim-filing')).find(s => s.time === '10:00')?.available).toBe(true);
    expect((await slotsOn(day)).find(s => s.time === '10:00')?.available).toBe(false);

    // One with upcoming bookings can't be removed; an empty one can.
    expect(await statusOf(send('DELETE', `${API.stations}/st1`))).toBe(409);
    expect(await statusOf(send('DELETE', `${API.stations}/${quick.id}`))).toBe(200);

    // A day off for one station: Block time, all day.
    const off = await send<{ time: string; durationMinutes: number }>('POST', API.blocks, { stationId: 'st2', date: addDays(today(), 4), allDay: true, time: '', durationMinutes: 0, reason: '' });
    expect(off).toMatchObject({ time: '09:00', durationMinutes: 600, reason: 'Day off' });
  }, 15000);

  it('keeps a held-back station for staff, and Admins open its times to customers one by one', async () => {
    const day = addDays(today(), 3);
    const stations = await get<Station[]>(API.stations);
    await send('PUT', `${API.stations}/st2`, { ...stations[1], heldBack: true });
    const board = () => get<SlotBoard>(API.slotBoard, { date: day });
    const at = (b: SlotBoard, time: string) => b.slots.find(s => s.time === time)!;

    // Customers can only get Station 1 at noon (the cat corner can't do dogs, but counts for cats): 2 of 3.
    const before = await board();
    expect(at(before, '12:00').freeStations).toBe(2);
    expect(before.heldBack).toEqual([expect.objectContaining({ id: 'st2', opened: [] })]);
    expect(before.heldBack[0].free).toContain('12:00');

    const open = (time: string, isOpen = true, headers = admin) =>
      send<SlotBoard>('PUT', `${API.slotBoard}/${day}/stations/st2`, { time, open: isOpen }, headers);
    expect(await statusOf(open('12:00', true, staff))).toBe(403);
    expect(await statusOf(send('PUT', `${API.slotBoard}/${day}/stations/st1`, { time: '12:00', open: true }))).toBe(400);
    const opened = await open('12:00');
    expect(opened.heldBack[0].opened).toEqual(['12:00']);
    expect(at(opened, '12:00').freeStations).toBe(3);
    expect((await open('12:00', false)).heldBack[0].opened).toEqual([]);

    // Closing 12:00 for the usual stations leaves the held-back station's own 12:00 alone; staff can still book it then.
    await open('12:00');
    const closed = await send<SlotBoard>('PUT', `${API.slotBoard}/${day}`, { time: '12:00', open: false });
    expect(at(closed, '12:00').state).toBe('closed');
    expect(closed.heldBack[0].opened).toEqual(['12:00']);
    expect(closed.heldBack[0].free).toContain('12:00');
    expect((await slotsOn(day)).find(s => s.time === '12:00')?.available).toBe(true);

    // Staff bookings fill the usual stations first and use the held-back one last.
    const book = (customerId: string, petId: string) =>
      send<Booking>('POST', API.bookings, { customerId, petId, serviceId: 'dog-signature-bath', date: day, time: '10:00' })
        .then(b => send<Booking>('POST', `${API.bookings}/${b.id}/confirm`));
    expect((await book('c1', 'p1')).stationId).toBe('st1');
    expect((await book('c10', 'p12')).stationId).toBe('st2');
  });

  it('uses the hold amount and link expiry from Settings › Payments', async () => {
    const s = await get<Settings>(API.settings);
    await send('PUT', `${API.settings}/payments`, { ...s.payments, slotHoldPaise: 20000, linkExpiryHours: 12 });
    await send('PUT', `${API.bookings}/PP-1049`, { customerId: 'c1', petId: 'p1', serviceId: 'dog-royal-package', date: addDays(today(), 1), time: '15:00' });
    const sent = await send<Booking>('POST', `${API.bookings}/PP-1049/payment-link`, { amountType: 'hold' });
    expect(sent.paymentLink?.amountPaise).toBe(20000);
    expect(new Date(sent.paymentLink!.expiresAt).getTime() - new Date(sent.paymentLink!.sentAt).getTime()).toBe(12 * 3_600_000);
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
    expect(refunded).toMatchObject({ status: 'refunded', amountPaise: target.amountPaise });
    expect((await get<Booking>(`${API.bookings}/${target.reference}`)).payments.at(-1)).toMatchObject({ kind: 'refund', refundOf: target.id });
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
