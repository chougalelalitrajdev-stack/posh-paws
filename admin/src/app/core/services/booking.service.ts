import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { API } from '../constants/api-endpoints';
import { withoutErrorAlert } from '../interceptors/error.interceptor';
import { AmountType, Booking, BookingBill, BookingDetails, BookingFilters, NewShopPayment, QuoteRequest, StageCounts } from '../models/booking.model';
import { CalendarData, DayAvailability, NewTimeBlock, SlotBoard, TimeBlock, WeekBoard } from '../models/calendar.model';
import { Paged } from '../models/paged.model';

/**
 * Bookings from first booked to finished groom, plus the calendar and slot availability.
 * Every change refreshes `counts`, which drives the Bookings tab counts.
 */
@Injectable({ providedIn: 'root' })
export class BookingService {
  private http = inject(HttpClient);

  private readonly _counts = signal<StageCounts | null>(null);
  readonly counts = this._counts.asReadonly();

  list(filters: BookingFilters): Observable<Paged<Booking>> {
    const params: Record<string, string | number> = {};
    if (filters.stages?.length) params['stage'] = filters.stages.join(',');
    if (filters.customerId) params['customerId'] = filters.customerId;
    if (filters.range && filters.range !== 'any') params['range'] = filters.range;
    if (filters.serviceId) params['serviceId'] = filters.serviceId;
    if (filters.petType) params['petType'] = filters.petType;
    if (filters.paymentStatus) params['paymentStatus'] = filters.paymentStatus;
    if (filters.page) params['page'] = filters.page;
    if (filters.pageSize) params['pageSize'] = filters.pageSize;
    return this.http.get<Paged<Booking>>(API.bookings, { params });
  }

  get(id: string): Observable<Booking> {
    return this.http.get<Booking>(`${API.bookings}/${id}`);
  }

  /** Reloads the stage counts in the background (Bookings tab counts). */
  refreshCounts(): void {
    this.http.get<StageCounts>(API.bookingCounts).subscribe({ next: c => this._counts.set(c), error: () => undefined });
  }

  calendar(from: string, days: number): Observable<CalendarData> {
    return this.http.get<CalendarData>(API.calendar, { params: { from, days } });
  }

  /** Free start times per day for a service, ignoring the booking being moved. */
  slots(serviceId: string, from: string, days: number, excludeBookingId?: string): Observable<DayAvailability[]> {
    const params: Record<string, string | number> = { serviceId, from, days };
    if (excludeBookingId) params['excludeBookingId'] = excludeBookingId;
    return this.http.get<DayAvailability[]>(API.slots, { params });
  }

  /** Creates or updates a draft. The New booking screen shows errors itself. */
  saveDetails(details: BookingDetails, id?: string): Observable<Booking> {
    const request = id
      ? this.http.put<Booking>(`${API.bookings}/${id}`, details, { context: withoutErrorAlert() })
      : this.http.post<Booking>(API.bookings, details, { context: withoutErrorAlert() });
    return this.refreshAfter(request);
  }

  /** The bill a phone booking would have (member session or discount, or an offer). Shows an offer code's problem inline. */
  quote(request: QuoteRequest): Observable<BookingBill> {
    return this.http.post<BookingBill>(`${API.bookings}/quote`, request, { context: withoutErrorAlert() });
  }

  /** A phone booking: confirmed now, paid at the shop. */
  confirm(id: string): Observable<Booking> {
    return this.action(id, 'confirm', {}, true);
  }

  /** Money taken at the shop (shop QR, cash or card). The dialog shows errors itself. */
  recordPayment(id: string, payment: NewShopPayment): Observable<Booking> {
    return this.action(id, 'payments', payment, true);
  }

  sendPaymentLink(id: string, amountType: AmountType): Observable<Booking> {
    return this.action(id, 'payment-link', { amountType }, true);
  }


  /** Mock backend only: pretends the customer paid through the link. */
  simulateOnlinePayment(id: string): Observable<Booking> {
    if (!environment.useMocks) throw new Error('Only available with mock data.');
    return this.action(id, 'demo-pay');
  }

  reschedule(id: string, date: string, time: string): Observable<Booking> {
    return this.action(id, 'reschedule', { date, time }, true);
  }

  cancel(id: string, reason?: string): Observable<Booking> {
    return this.action(id, 'cancel', { reason });
  }

  complete(id: string): Observable<Booking> {
    return this.action(id, 'complete');
  }

  markNoShow(id: string): Observable<Booking> {
    return this.action(id, 'no-show');
  }

  addNote(id: string, text: string): Observable<Booking> {
    return this.action(id, 'notes', { text });
  }

  addBlock(block: NewTimeBlock): Observable<TimeBlock> {
    return this.http.post<TimeBlock>(API.blocks, block, { context: withoutErrorAlert() });
  }

  removeBlock(id: string): Observable<void> {
    return this.http.delete<void>(`${API.blocks}/${id}`);
  }

  /** One day's start times: usual, closed by staff, or extra. */
  slotBoard(date: string): Observable<SlotBoard> {
    return this.http.get<SlotBoard>(API.slotBoard, { params: { date } });
  }

  /** Open or close one start time on one date; opening a time outside the usual ones adds it as an extra time. */
  setSlot(date: string, time: string, open: boolean): Observable<SlotBoard> {
    return this.http.put<SlotBoard>(`${API.slotBoard}/${date}`, { time, open }, { context: withoutErrorAlert() });
  }

  /** The usual week's start times (Availability › Week). */
  weekBoard(): Observable<WeekBoard> {
    return this.http.get<WeekBoard>(API.weekBoard);
  }

  /** Close or open a start time every week on one weekday (0 = Monday). Admin and Super Admin. */
  setWeeklySlot(weekday: number, time: string, open: boolean): Observable<WeekBoard> {
    return this.http.put<WeekBoard>(`${API.weekBoard}/${weekday}`, { time, open }, { context: withoutErrorAlert() });
  }

  /** POST /bookings/{id}/{name}. `inline` = the screen shows errors itself (e.g. 409 slot taken). */
  private action(id: string, name: string, body: object = {}, inline = false): Observable<Booking> {
    const options = inline ? { context: withoutErrorAlert() } : {};
    return this.refreshAfter(this.http.post<Booking>(`${API.bookings}/${id}/${name}`, body, options));
  }

  private refreshAfter(request: Observable<Booking>): Observable<Booking> {
    return request.pipe(tap(() => this.refreshCounts()));
  }
}
