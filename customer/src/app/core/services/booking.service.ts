import { HttpClient } from '@angular/common/http';
import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';
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
    effect(() => {
      const userId = this.auth.user()?.id;
      untracked(() => void this.load(userId));
    });
  }

  getSlots(date: string, serviceId: string): Promise<TimeSlot[]> {
    return firstValueFrom(this.http.get<TimeSlot[]>(API.slots, { params: { date, serviceId } }));
  }

  /** The booking page shows errors itself (e.g. 409 when the slot was just taken), so no global toast. */
  async book(request: BookingRequest): Promise<Booking> {
    const booking = await firstValueFrom(this.http.post<Booking>(API.bookings, request, { context: withoutErrorAlert() }));
    this._bookings.update(list => [...list, booking]);
    return booking;
  }

  async cancel(id: string): Promise<void> {
    const cancelled = await firstValueFrom(this.http.post<Booking>(`${API.bookings}/${id}/cancel`, {}));
    this._bookings.update(list => list.map(b => (b.id === cancelled.id ? cancelled : b)));
  }

  private async load(userId: string | undefined): Promise<void> {
    if (!userId) {
      this._bookings.set([]);
      return;
    }
    this._loading.set(true);
    try {
      const bookings = await firstValueFrom(this.http.get<Booking[]>(API.bookings));
      if (this.auth.user()?.id === userId) this._bookings.set(bookings);
    } finally {
      this._loading.set(false);
    }
  }
}
