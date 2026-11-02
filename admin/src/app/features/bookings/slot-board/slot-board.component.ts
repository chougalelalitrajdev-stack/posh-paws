import { Component, ChangeDetectionStrategy, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { catchError, finalize, of, switchMap, tap } from 'rxjs';
import { BoardSlot, SlotBoard } from '../../../core/models/calendar.model';
import { BookingService } from '../../../core/services/booking.service';
import { errorMessage } from '../../../core/utils/error.utils';

/** One day's start times: staff close usual times or open extra ones (Bookings › Slots). The server applies them to every booking. */
@Component({
  selector: 'pp-slot-board',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './slot-board.component.html',
  styleUrl: './slot-board.component.scss',
})
export class SlotBoardComponent {
  private bookingService = inject(BookingService);

  readonly date = input.required<string>();

  protected board = signal<SlotBoard | null>(null);
  protected busyTime = signal<string | null>(null);
  protected extraTime = signal('');
  protected error = signal<string | null>(null);

  protected hoursText = computed(() => {
    const b = this.board();
    if (!b) return '';
    const { hours, closure } = b;
    if (!hours.open || (closure && !closure.closesAt)) return closure ? `Closed all day · ${closure.name}` : 'Closed all day';
    const closes = closure?.closesAt ?? hours.closes;
    const pause = hours.breakFrom && hours.breakTo ? ` · break ${hours.breakFrom}–${hours.breakTo}` : '';
    return `Open ${hours.opens}–${closes}${closure ? ` (${closure.name})` : ''}${pause} · a start every ${b.stepMinutes} min · ${b.stations} stations`;
  });

  protected counts = computed(() => {
    const slots = (this.board()?.slots ?? []).filter(s => s.blockedBy !== 'Past');
    return {
      open: slots.filter(s => this.isOpen(s)).length,
      closed: slots.filter(s => s.state === 'closed').length,
      extra: slots.filter(s => s.state === 'extra').length,
    };
  });

  constructor() {
    toObservable(this.date).pipe(
      tap(() => {
        this.board.set(null);
        this.error.set(null);
      }),
      switchMap(date => this.bookingService.slotBoard(date).pipe(catchError(() => of(null)))),
      takeUntilDestroyed(),
    ).subscribe(board => this.board.set(board));
  }

  /** Customers can start a booking then (if a station is free). */
  protected isOpen(s: BoardSlot): boolean {
    return s.state === 'extra' || (s.state === 'open' && !s.blockedBy);
  }

  protected label(s: BoardSlot): string {
    if (s.state === 'closed') return 'Closed';
    if (s.blockedBy) return s.blockedBy;
    const free = s.freeStations ? `${s.freeStations} free` : 'Full';
    return s.state === 'extra' ? `Extra · ${free}` : free;
  }

  toggle(s: BoardSlot): void {
    this.setSlot(s.time, !this.isOpen(s));
  }

  addExtra(): void {
    if (this.extraTime()) this.setSlot(this.extraTime(), true, () => this.extraTime.set(''));
  }

  onExtraInput(e: Event): void {
    this.extraTime.set((e.target as HTMLInputElement).value);
  }

  private setSlot(time: string, open: boolean, done?: () => void): void {
    this.busyTime.set(time);
    this.error.set(null);
    this.bookingService.setSlot(this.date(), time, open).pipe(finalize(() => this.busyTime.set(null))).subscribe({
      next: board => {
        this.board.set(board);
        done?.();
      },
      error: e => this.error.set(errorMessage(e)),
    });
  }
}
