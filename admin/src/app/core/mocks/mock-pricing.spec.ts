import { HttpClient, HttpErrorResponse, HttpHeaders, provideHttpClient, withInterceptors } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { API } from '../constants/api-endpoints';
import { Booking, BookingBill } from '../models/booking.model';
import { Customer } from '../models/customer.model';
import { Offer } from '../models/offer.model';
import { Paged } from '../models/paged.model';
import { Payment, PaymentSummary } from '../models/payment.model';
import { PlanOption, Subscription } from '../models/subscription.model';
import { addDays, today } from '../utils/date.utils';
import { resetDb } from './mock-db';
import { mockInterceptor } from './mock.interceptor';

const admin = new HttpHeaders({ Authorization: 'Bearer mock-staff:st-2' }); // Meera K., Admin
const owner = new HttpHeaders({ Authorization: 'Bearer mock-staff:st-1' }); // Sanjay R., Super Admin
const staff = new HttpHeaders({ Authorization: 'Bearer mock-staff:st-3' }); // Amit J., Staff

/** Root CLAUDE.md › Booking & payment rules. */
describe('booking money rules (mock backend)', () => {
  let http: HttpClient;
  const get = <T>(url: string, params: Record<string, string | number> = {}) => firstValueFrom(http.get<T>(url, { headers: admin, params }));
  const post = <T>(url: string, body: object = {}, headers = admin) => firstValueFrom(http.post<T>(url, body, { headers }));
  const put = <T>(url: string, body: object) => firstValueFrom(http.put<T>(url, body, { headers: admin }));
  const statusOf = (p: Promise<unknown>) => p.then(() => 200, (e: HttpErrorResponse) => e.status);
  const quote = (customerId: string, serviceId: string, offerCode?: string) => post<BookingBill>(`${API.bookings}/quote`, { customerId, serviceId, offerCode });
  const book = async (id: string, customerId: string, petId: string, serviceId: string, offerCode?: string) => {
    await put(`${API.bookings}/${id}`, { customerId, petId, serviceId, date: addDays(today(), 2), time: '10:00', offerCode });
    return post<Booking>(`${API.bookings}/${id}/confirm`);
  };

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 27, 8, 0)); // Tue 27 Oct 2026, 8 am
    resetDb();
    TestBed.configureTestingModule({ providers: [provideHttpClient(withInterceptors([mockInterceptor]))] });
    http = TestBed.inject(HttpClient);
  });

  afterEach(() => vi.useRealTimers());

  it('confirms a phone booking with no advance, then takes the balance at the shop', async () => {
    // Arjun (no plan) books a Signature Bath by phone.
    const b = await book('PP-1049', 'c7', 'p9', 'dog-signature-bath');
    expect(b).toMatchObject({ stage: 'confirmed', paymentStatus: 'unpaid', payments: [] });
    expect(b.bill).toMatchObject({ totalPaise: 120000, advancePaise: 0, balancePaise: 120000, discount: null });

    expect(await statusOf(post(`${API.bookings}/PP-1049/payments`, { amountPaise: 130000, method: 'cash' }))).toBe(400); // more than the balance
    expect(await statusOf(post(`${API.bookings}/PP-1049/payments`, { amountPaise: 1000, method: 'bitcoin' }))).toBe(400);
    const part = await post<Booking>(`${API.bookings}/PP-1049/payments`, { amountPaise: 20000, method: 'cash' });
    expect(part).toMatchObject({ paymentStatus: 'part_paid', bill: { paidPaise: 20000, balancePaise: 100000 } });
    const done = await post<Booking>(`${API.bookings}/PP-1049/payments`, { amountPaise: 100000, method: 'upi_qr' });
    expect(done).toMatchObject({ paymentStatus: 'paid', bill: { balancePaise: 0 } });
    expect(done.payments.map(p => `${p.kind}:${p.method}`)).toEqual(['balance:cash', 'balance:upi_qr']);
  });

  it('covers a plan service with a session, uses it on confirm and gives it back on cancel', async () => {
    const before = (await get<Customer>(`${API.customers}/c1`)).plan!; // Ananya, Posh: 3 of 5 left
    const bill = await quote('c1', 'dog-signature-bath');
    expect(bill).toMatchObject({ totalPaise: 0, discount: { kind: 'session' } });

    const b = await book('PP-1051', 'c1', 'p1', 'dog-signature-bath');
    expect(b).toMatchObject({ stage: 'confirmed', paymentStatus: 'paid', bill: { totalPaise: 0 } });
    expect((await get<Customer>(`${API.customers}/c1`)).plan!.sessionsLeft).toBe(before.sessionsLeft! - 1);
    expect(await statusOf(post(`${API.bookings}/PP-1051/payment-link`, { amountType: 'full' }))).toBe(409); // nothing to pay

    await post(`${API.bookings}/PP-1051/cancel`);
    expect((await get<Customer>(`${API.customers}/c1`)).plan!.sessionsLeft).toBe(before.sessionsLeft);
  });

  it('uses the better of the member discount and an offer, never both, and checks the code', async () => {
    // Posh 10% vs DIWALI20 20% on a Royal Package (not on the Posh plan): the offer wins.
    expect(await quote('c1', 'dog-royal-package')).toMatchObject({ totalPaise: 405000, discount: { kind: 'membership' } });
    expect(await quote('c1', 'dog-royal-package', 'diwali20')).toMatchObject({ totalPaise: 360000, discount: { kind: 'offer', label: 'DIWALI20 · Diwali grooming week' } });
    // A plan session still beats any offer.
    expect(await quote('c1', 'dog-signature-bath', 'DIWALI20')).toMatchObject({ totalPaise: 0, discount: { kind: 'session' } });

    expect(await statusOf(quote('c1', 'dog-royal-package', 'NOPE'))).toBe(400);
    expect(await statusOf(quote('c3', 'cat-gentle-cat-bath', 'DIWALI20'))).toBe(400); // dog services only
    expect(await statusOf(quote('c1', 'dog-royal-package', 'MEOW10'))).toBe(400); // ended

    const usedBefore = (await get<Offer[]>(API.offers)).find(o => o.code === 'DIWALI20')!.used;
    await book('PP-1051', 'c1', 'p1', 'dog-royal-package', 'DIWALI20');
    expect((await get<Offer[]>(API.offers)).find(o => o.code === 'DIWALI20')!.used).toBe(usedBefore + 1);
    expect(await statusOf(quote('c1', 'dog-royal-package', 'DIWALI20'))).toBe(400); // one use per customer
    await post(`${API.bookings}/PP-1051/cancel`);
    expect((await get<Offer[]>(API.offers)).find(o => o.code === 'DIWALI20')!.used).toBe(usedBefore);
  });

  it('refunds an app advance when cancelled 24 h or more before, and keeps it when later', async () => {
    // PP-1034: app booking in 3 days, ₹100 advance paid online.
    const early = await post<Booking>(`${API.bookings}/PP-1034/cancel`);
    expect(early.payments.map(p => p.kind)).toEqual(['advance', 'refund']);
    expect(early.paymentStatus).toBe('refunded');
    expect(early.activity[0].detail).toContain('advance was refunded');

    // PP-1036: app booking today at 17:00.
    const late = await post<Booking>(`${API.bookings}/PP-1036/cancel`);
    expect(late.payments.map(p => p.kind)).toEqual(['advance']);
    expect(late).toMatchObject({ paymentStatus: 'paid', bill: { balancePaise: 0 } });
    expect(late.activity[0].detail).toContain('advance is kept');
  });

  it('lists balances due and lets the Super Admin refund one payment', async () => {
    const due = await get<Paged<Payment>>(API.payments, { tab: 'due', pageSize: 100 });
    expect(due.items.map(p => p.reference)).toContain('PP-1035'); // phone booking, nothing paid yet
    expect((await get<PaymentSummary>(API.paymentSummary, { from: '', to: '' })).duePaise).toBeGreaterThan(0);

    const advance = (await get<Paged<Payment>>(API.payments, { tab: 'paid', pageSize: 100 })).items.find(p => p.reference === 'PP-1033')!;
    expect(advance.detail).toBe('Advance · Online');
    expect(await statusOf(post(`${API.payments}/${advance.id}/refund`))).toBe(403); // Admin
    await post(`${API.payments}/${advance.id}/refund`, {}, owner);
    const b = await get<Booking>(`${API.bookings}/PP-1033`);
    expect(b.payments.at(-1)).toMatchObject({ kind: 'refund', refundOf: advance.id });
    expect(await statusOf(post(`${API.payments}/${advance.id}/refund`, {}, owner))).toBe(409);
  });

  describe('plan changes', () => {
    const options = (id: string) => get<PlanOption[]>(`${API.subscriptions}/${id}/plan-options`);
    const change = (id: string, body: object, headers = admin) => post<Subscription>(`${API.subscriptions}/${id}/change-plan`, body, headers);

    it('upgrades now: the difference is paid, used sessions still count, the renewal date stays', async () => {
      // Aditi (c5) is on Basic (₹499, 1 of 2 used).
      const opts = await options('SUB-104');
      expect(opts.map(o => `${o.name}:${o.change}:${o.payNowPaise}:${o.sessionsLeft}`)).toEqual(['Basic:current:0:1', 'Posh:upgrade:50000:4', 'Royal:upgrade:150000:null']);
      expect(await statusOf(change('SUB-104', { planId: 'posh', method: 'cash' }, staff))).toBe(403);
      expect(await statusOf(change('SUB-104', { planId: 'posh' }))).toBe(400); // how they paid the difference
      expect(await statusOf(change('SUB-104', { planId: 'basic' }))).toBe(400); // already on it

      const before = (await get<Paged<Subscription>>(API.subscriptions, { tab: 'all', pageSize: 50 })).items.find(s => s.id === 'SUB-104')!;
      const sub = await change('SUB-104', { planId: 'posh', method: 'cash' });
      expect(sub).toMatchObject({ planId: 'posh', planName: 'Posh', pricePaise: 99900, sessionsTotal: 5, sessionsUsed: 1, renewsOn: before.renewsOn, nextPlan: null });
      expect(sub.changes[0]).toMatchObject({ kind: 'upgrade', fromPlan: 'Basic', toPlan: 'Posh', paidPaise: 50000, method: 'cash', by: 'Meera K.' });

      // The new plan prices bookings straight away: a Full Groom is a Posh session, not a Basic one.
      expect((await get<Customer>(`${API.customers}/${sub.customer.id}`)).plan).toMatchObject({ name: 'Posh', sessionsLeft: 4, discountPercent: 10 });
      expect(await quote(sub.customer.id, 'cat-full-groom-trim')).toMatchObject({ totalPaise: 0, discount: { kind: 'session' } });
      const paid = await get<Paged<Payment>>(API.payments, { tab: 'paid', pageSize: 200 });
      expect(paid.items.find(p => p.item === 'Upgrade from Basic' && p.customer.id === sub.customer.id)).toMatchObject({ amountPaise: 50000, detail: 'Difference · Cash' });
    });

    it('downgrades at the next renewal, and can be called off', async () => {
      // Ananya (c1) is on Posh.
      const basic = (await options('SUB-101')).find(o => o.planId === 'basic')!;
      expect(basic).toMatchObject({ change: 'downgrade', payNowPaise: 0 });
      const sub = await change('SUB-101', { planId: 'basic' });
      expect(basic.startsOn).toBe(sub.renewsOn);
      expect(sub).toMatchObject({ planId: 'posh', pricePaise: 99900, nextPlan: { planId: 'basic', pricePaise: 49900 } });
      expect((await get<Customer>(`${API.customers}/c1`)).plan).toMatchObject({ name: 'Posh', nextPlanName: 'Basic' });

      // The renewal link charges the plan they move to.
      const link = await post<Subscription>(`${API.subscriptions}/SUB-101/payment-link`);
      expect(link.paymentLink).toMatchObject({ amountPaise: 49900, planName: 'Basic' });

      const kept = await change('SUB-101', { planId: 'posh' });
      expect(kept).toMatchObject({ planId: 'posh', nextPlan: null, paymentLink: null });
      expect(kept.changes[0]).toMatchObject({ kind: 'keep', fromPlan: 'Posh', toPlan: 'Basic' });
    });

    it('switches a plan that isn’t paid yet for free, and refuses ended plans', async () => {
      // Isha (c8) picked Basic and hasn't paid the first month.
      const royal = (await options('SUB-108')).find(o => o.planId === 'royal')!;
      expect(royal).toMatchObject({ change: 'switch', payNowPaise: 0 });
      const sub = await change('SUB-108', { planId: 'royal' });
      expect(sub).toMatchObject({ status: 'payment_pending', planId: 'royal', pricePaise: 199900, sessionsTotal: null, paymentLink: null });
      expect((await post<Subscription>(`${API.subscriptions}/SUB-108/payment-link`)).paymentLink).toMatchObject({ amountPaise: 199900, planName: 'Royal' });

      expect(await statusOf(options('SUB-109'))).toBe(409); // expired
    });
  });
});
