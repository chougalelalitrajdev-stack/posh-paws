import { Component, ChangeDetectionStrategy, computed, inject, model, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { catchError, finalize, of, switchMap, tap } from 'rxjs';
import { BoardSlot, SlotBoard } from '../../../core/models/calendar.model';
import { AlertService } from '../../../core/services/alert.service';
import { BookingService } from '../../../core/services/booking.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import { SettingsService } from '../../../core/services/settings.service';
import { addDays, dayLabel, longDate, shortDate, today } from '../../../core/utils/date.utils';
import { errorMessage } from '../../../core/utils/error.utils';
import { HolidayDialogComponent } from '../holiday-dialog/holiday-dialog.component';

/**
 * Availability › Day: one date's start times. Staff close a time or open an extra one for this date only,
 * or close the whole day. The weekly pattern (Week tab) shows through; a change here wins for this date.
 */
@Component({
  selector: 'pp-day',
  imports: [HolidayDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './day.component.html',
  styleUrl: './day.component.scss',
})
export class DayComponent {
  private bookingService = inject(BookingService);
  private settingsService = inject(SettingsService);
  private confirm = inject(ConfirmService);
  private alert = inject(AlertService);

  /** YYYY-MM-DD; kept by the page so it stays when switching tabs. */
  readonly date = model.required<string>();

  protected board = signal<SlotBoard | null>(null);
  protected busyTime = signal<string | null>(null);
  protected extraTime = signal('');
  protected error = signal<string | null>(null);
  protected closingDay = signal(false);

  protected title = computed(() => `${dayLabel(this.date())}${dayLabel(this.date()) === shortDate(this.date()) ? '' : ` · ${shortDate(this.date())}`}`);
  protected isToday = computed(() => this.date() === today());
  protected isPast = computed(() => this.date() < today());
  /** The holiday on this date, with its id so it can be removed. */
  protected holiday = computed(() => this.settingsService.settings()?.booking.closures.find(c => c.date === this.date()) ?? null);

  protected hoursText = computed(() => {
    const b = this.board();
    if (!b) return '';
    const { hours, closure } = b;
    if (!hours.open || (closure && !closure.closesAt)) return 'Closed all day';
    const closes = closure?.closesAt ?? hours.closes;
    const pause = hours.breakFrom && hours.breakTo ? ` · break ${hours.breakFrom}–${hours.breakTo}` : '';
    return `Open ${hours.opens}–${closes}${pause} · a start every ${b.stepMinutes} min · ${b.stations} stations`;
  });

  protected counts = computed(() => {
    const slots = (this.board()?.slots ?? []).filter(s => s.blockedBy !== 'Past');
    return {
      open: slots.filter(s => this.isOpen(s)).length,
      closed: slots.filter(s => s.state === 'closed').length,
      extra: slots.filter(s => s.state === 'extra').length,
    };
  });

  /** Bump to load again (after a holiday is added or removed). */
  private version = signal(0);
  private query = computed(() => ({ date: this.date(), version: this.version() }));

  constructor() {
    this.settingsService.load().subscribe();
    toObservable(this.query).pipe(
      tap(() => this.error.set(null)),
      switchMap(({ date }) => this.bookingService.slotBoard(date).pipe(catchError(() => of(null)))),
      takeUntilDestroyed(),
    ).subscribe(board => this.board.set(board));
  }

  move(days: number): void {
    this.board.set(null);
    this.date.update(d => addDays(d, days));
  }

  goToday(): void {
    this.board.set(null);
    this.date.set(today());
  }

  /** Customers can start a booking then (if a station is free). */
  protected isOpen(s: BoardSlot): boolean {
    return s.state === 'extra' || (s.state === 'open' && !s.blockedBy);
  }

  protected label(s: BoardSlot): string {
    if (s.state === 'closed') return s.weekly === 'closed' ? 'Closed weekly' : 'Closed';
    if (s.blockedBy) return s.blockedBy;
    const free = s.freeStations ? `${s.freeStations} free` : 'Full';
    if (s.state === 'extra') return `${s.weekly === 'extra' ? 'Weekly' : 'Extra'} · ${free}`;
    return s.weekly === 'closed' ? `Today · ${free}` : free;
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

  onDateInput(e: Event): void {
    const value = (e.target as HTMLInputElement).value;
    if (value) {
      this.board.set(null);
      this.date.set(value);
    }
  }

  onDayClosed(): void {
    this.closingDay.set(false);
    this.version.update(v => v + 1);
  }

  async reopenDay(): Promise<void> {
    const h = this.holiday();
    if (!h) return;
    const ok = await this.confirm.ask({
      title: `Reopen ${longDate(h.date)}?`, message: `${h.name} is removed and customers can book this day again.`, confirmLabel: 'Reopen day',
    });
    if (!ok) return;
    this.settingsService.removeClosure(h.id).subscribe(() => {
      this.alert.success(`${h.name} removed. The day is open again.`);
      this.version.update(v => v + 1);
    });
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
