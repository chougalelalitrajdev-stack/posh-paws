import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { Observable, catchError, distinctUntilChanged, finalize, map, of, switchMap, tap } from 'rxjs';
import { API } from '../constants/api-endpoints';
import { withoutErrorAlert } from '../interceptors/error.interceptor';
import { Booking, BookingRequest, TimeSlot } from '../models/booking.model';
import { slotStart } from '../utils/date.utils';
import { AuthService } from './auth.service';

const byStart = (a: Booking, b: Booking) => slotStart(a.date, a.time).getTime() - slotStart(b.date, b.time).getTime();

/** Slot availability plus the logged-in user's bookings. Reloads on login and clears on logout. */
@Injectable({ providedIn: 'root' })
export class BookingService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);

  private readonly _bookings = signal<Booking[]>([]);
  private readonly _loading = signal(false);

  readonly bookings = this._bookings.asReadonly();
  readonly loading = this._loading.asReadonly();

  /** Confirmed and still ahead, soonest first. */
  readonly upcoming = computed(() =>
    this._bookings().filter(b => b.status === 'confirmed' && slotStart(b.date, b.time) >= new Date()).sort(byStart),
  );

  /** Everything else (completed, cancelled or already started), latest first. */
  readonly past = computed(() => {
    const upcoming = new Set(this.upcoming());
    return this._bookings().filter(b => !upcoming.has(b)).sort(byStart).reverse();
  });

  constructor() {
    // A new user cancels the previous user's request (switchMap), so bookings never mix.
    toObservable(this.auth.user).pipe(
      map(user => user?.id ?? null),
      distinctUntilChanged(),
      switchMap(userId => (userId ? this.fetch() : of([]))),
      takeUntilDestroyed(),
    ).subscribe(bookings => this._bookings.set(bookings));
  }

  getSlots(date: string, serviceId: string): Observable<TimeSlot[]> {
    return this.http.get<TimeSlot[]>(API.slots, { params: { date, serviceId } });
  }

  /** The booking page shows errors itself (e.g. 409 when the slot was just taken), so no global toast. */
  book(request: BookingRequest): Observable<Booking> {
    return this.http.post<Booking>(API.bookings, request, { context: withoutErrorAlert() }).pipe(
      tap(booking => this._bookings.update(list => [...list, booking])),
    );
  }

  cancel(id: string): Observable<Booking> {
    return this.http.post<Booking>(`${API.bookings}/${id}/cancel`, {}).pipe(
      tap(cancelled => this._bookings.update(list => list.map(b => (b.id === cancelled.id ? cancelled : b)))),
    );
  }

  private fetch(): Observable<Booking[]> {
    this._loading.set(true);
    return this.http.get<Booking[]>(API.bookings).pipe(
      catchError(() => of([])), // the error interceptor has shown a toast
      finalize(() => this._loading.set(false)),
    );
  }
}
