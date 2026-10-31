import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { API } from '../constants/api-endpoints';
import { withoutErrorAlert } from '../interceptors/error.interceptor';
import { AmountType, Booking, BookingDetails, BookingFilters, CallOutcome, StageCounts } from '../models/booking.model';
import { CalendarData, DayAvailability, NewTimeBlock, TimeBlock } from '../models/calendar.model';
import { Paged } from '../models/paged.model';

/**
 * Bookings from first request to finished groom, plus the calendar and slot availability.
 * Every change refreshes `counts`, which drives the tab counts and the Requests badge.
 */
@Injectable({ providedIn: 'root' })
export class BookingService {
  private http = inject(HttpClient);

  private readonly _counts = signal<StageCounts | null>(null);
  readonly counts = this._counts.asReadonly();

  list(filters: BookingFilters): Promise<Paged<Booking>> {
    const params: Record<string, string | number> = {};
    if (filters.stages?.length) params['stage'] = filters.stages.join(',');
    if (filters.customerId) params['customerId'] = filters.customerId;
    if (filters.range && filters.range !== 'any') params['range'] = filters.range;
    if (filters.serviceId) params['serviceId'] = filters.serviceId;
    if (filters.petType) params['petType'] = filters.petType;
    if (filters.paymentStatus) params['paymentStatus'] = filters.paymentStatus;
    if (filters.page) params['page'] = filters.page;
    if (filters.pageSize) params['pageSize'] = filters.pageSize;
    return firstValueFrom(this.http.get<Paged<Booking>>(API.bookings, { params }));
  }

  get(id: string): Promise<Booking> {
    return firstValueFrom(this.http.get<Booking>(`${API.bookings}/${id}`));
  }

  async refreshCounts(): Promise<void> {
    this._counts.set(await firstValueFrom(this.http.get<StageCounts>(API.bookingCounts)));
  }

  calendar(from: string, days: number): Promise<CalendarData> {
    return firstValueFrom(this.http.get<CalendarData>(API.calendar, { params: { from, days } }));
  }

  /** Free start times per day for a service, ignoring the booking being moved. */
  slots(serviceId: string, from: string, days: number, excludeBookingId?: string): Promise<DayAvailability[]> {
    const params: Record<string, string | number> = { serviceId, from, days };
    if (excludeBookingId) params['excludeBookingId'] = excludeBookingId;
    return firstValueFrom(this.http.get<DayAvailability[]>(API.slots, { params }));
  }

  /** Creates a draft, or updates a request/draft. The New booking screen shows errors itself. */
  saveDetails(details: BookingDetails, id?: string): Promise<Booking> {
    const request = id
      ? this.http.put<Booking>(`${API.bookings}/${id}`, details, { context: withoutErrorAlert() })
      : this.http.post<Booking>(API.bookings, details, { context: withoutErrorAlert() });
    return this.refreshAfter(firstValueFrom(request));
  }

  sendPaymentLink(id: string, amountType: AmountType): Promise<Booking> {
    return this.action(id, 'payment-link', { amountType }, true);
  }

  setCallOutcome(id: string, outcome: CallOutcome): Promise<Booking> {
    return this.action(id, 'call-outcome', { outcome });
  }

  markPaid(id: string): Promise<Booking> {
    return this.action(id, 'mark-paid');
  }

  /** Mock backend only: pretends the customer paid through the link. */
  simulateOnlinePayment(id: string): Promise<Booking> {
    if (!environment.useMocks) throw new Error('Only available with mock data.');
    return this.action(id, 'demo-pay');
  }

  reschedule(id: string, date: string, time: string): Promise<Booking> {
    return this.action(id, 'reschedule', { date, time }, true);
  }

  cancel(id: string, reason?: string): Promise<Booking> {
    return this.action(id, 'cancel', { reason });
  }

  complete(id: string): Promise<Booking> {
    return this.action(id, 'complete');
  }

  markNoShow(id: string): Promise<Booking> {
    return this.action(id, 'no-show');
  }

  addNote(id: string, text: string): Promise<Booking> {
    return this.action(id, 'notes', { text });
  }

  addBlock(block: NewTimeBlock): Promise<TimeBlock> {
    return firstValueFrom(this.http.post<TimeBlock>(API.blocks, block, { context: withoutErrorAlert() }));
  }

  async removeBlock(id: string): Promise<void> {
    await firstValueFrom(this.http.delete(`${API.blocks}/${id}`));
  }

  /** POST /bookings/{id}/{name}. `inline` = the screen shows errors itself (e.g. 409 slot taken). */
  private action(id: string, name: string, body: object = {}, inline = false): Promise<Booking> {
    const options = inline ? { context: withoutErrorAlert() } : {};
    return this.refreshAfter(firstValueFrom(this.http.post<Booking>(`${API.bookings}/${id}/${name}`, body, options)));
  }

  private async refreshAfter(request: Promise<Booking>): Promise<Booking> {
    const booking = await request;
    void this.refreshCounts();
    return booking;
  }
}
