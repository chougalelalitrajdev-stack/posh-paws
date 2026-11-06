import { Component, ChangeDetectionStrategy, computed, inject, signal } from '@angular/core';
import { FormArray, FormControl, FormGroup, NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { catchError, finalize, of, switchMap } from 'rxjs';
import { SETTINGS_ROLES } from '../../../core/constants/app.constants';
import { WeekBoard, WeekSlot } from '../../../core/models/calendar.model';
import { BookingSettings, DayHours } from '../../../core/models/settings.model';
import { AlertService } from '../../../core/services/alert.service';
import { AuthService } from '../../../core/services/auth.service';
import { BookingService } from '../../../core/services/booking.service';
import { CatalogService } from '../../../core/services/catalog.service';
import { SettingsService } from '../../../core/services/settings.service';
import { errorMessage } from '../../../core/utils/error.utils';
import { SwitchComponent } from '../../../shared/components/switch/switch.component';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const minutes = (values: number[]) => values.map(value => ({ value, label: value ? `${value} minutes` : 'None' }));
const OPTIONS = {
  step: minutes([15, 20, 30, 45, 60]),
  buffer: minutes([0, 5, 10, 15, 20, 30]),
  ahead: [7, 14, 30, 60, 90].map(value => ({ value, label: `${value} days ahead` })),
  notice: [
    { value: 0, label: 'No minimum' }, { value: 30, label: '30 minutes' }, { value: 60, label: '1 hour' },
    { value: 120, label: '2 hours' }, { value: 240, label: '4 hours' }, { value: 1440, label: '1 day' },
  ],
};

type DayGroup = FormGroup<{ open: FormControl<boolean>; opens: FormControl<string>; closes: FormControl<string>; breakFrom: FormControl<string>; breakTo: FormControl<string> }>;

/**
 * Availability › Week: the usual week. Start times closed or added every week, then opening hours, breaks and slot rules.
 * Admin and Super Admin change it; staff see it. The backend offers slots by these.
 */
@Component({
  selector: 'pp-week',
  imports: [ReactiveFormsModule, RouterLink, SwitchComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './week.component.html',
  styleUrl: './week.component.scss',
})
export class WeekComponent {
  private settingsService = inject(SettingsService);
  private bookingService = inject(BookingService);
  private alert = inject(AlertService);
  private auth = inject(AuthService);
  private fb = inject(NonNullableFormBuilder);
  protected catalog = inject(CatalogService);

  protected readonly days = DAYS;
  protected readonly options = OPTIONS;
  protected canEdit = computed(() => this.auth.hasRole(...SETTINGS_ROLES));

  // ── Weekly start times ──
  protected board = signal<WeekBoard | null>(null);
  /** "day-time" of the chip being saved. */
  protected busy = signal<string | null>(null);
  protected boardError = signal<string | null>(null);
  protected addDay = signal(5);
  protected addTime = signal('');
  /** Bump to load the board again (after the hours change). */
  private version = signal(0);

  // ── Hours and rules ──
  protected saving = signal(false);
  protected error = signal<string | null>(null);
  protected form = this.fb.group({
    hours: this.fb.array<DayGroup>([]),
    slotStepMinutes: [30],
    bufferMinutes: [15],
    bookAheadDays: [30],
    minNoticeMinutes: [30],
  });
  protected stations = computed(() => this.catalog.stations().map(s => s.name).join(', '));

  constructor() {
    this.catalog.load().subscribe();
    this.settingsService.load().subscribe(s => this.fill(s.booking));
    toObservable(this.version).pipe(
      switchMap(() => this.bookingService.weekBoard().pipe(catchError(() => of(null)))),
      takeUntilDestroyed(),
    ).subscribe(board => board && this.board.set(board));
  }

  get hours(): FormArray<DayGroup> {
    return this.form.controls.hours;
  }

  dirty(): boolean {
    return this.form.dirty;
  }

  protected hoursText(d: DayHours): string {
    if (!d.open) return 'Closed';
    return `${d.opens}–${d.closes}${d.breakFrom && d.breakTo ? ` · break ${d.breakFrom}–${d.breakTo}` : ''}`;
  }

  protected label(s: WeekSlot): string {
    return { open: '', closed: 'Closed', extra: 'Extra', break: 'Break' }[s.state];
  }

  /** Open: close it every week. Closed or in the break: open it every week. Extra: remove it. */
  toggle(day: number, s: WeekSlot): void {
    this.setWeekly(day, s.time, s.state === 'closed' || s.state === 'break');
  }

  addWeekly(): void {
    if (this.addTime()) this.setWeekly(this.addDay(), this.addTime(), true, () => this.addTime.set(''));
  }

  onAddDay(e: Event): void {
    this.addDay.set(Number((e.target as HTMLSelectElement).value));
  }

  onAddTime(e: Event): void {
    this.addTime.set((e.target as HTMLInputElement).value);
  }

  setOpen(group: DayGroup, open: boolean): void {
    group.controls.open.setValue(open);
    this.syncDay(group);
    this.form.markAsDirty();
  }

  discard(): void {
    const s = this.settingsService.settings();
    if (s) this.fill(s.booking);
  }

  save(): void {
    if (this.saving()) return;
    const v = this.form.getRawValue();
    const current = this.settingsService.settings()?.booking.hours ?? [];
    const draft: BookingSettings = {
      hours: v.hours.map((h, day): DayHours => ({
        day, open: h.open, opens: h.opens, closes: h.closes, breakFrom: h.breakFrom || null, breakTo: h.breakTo || null,
        closedStarts: current[day]?.closedStarts ?? [], extraStarts: current[day]?.extraStarts ?? [],
      })),
      slotStepMinutes: Number(v.slotStepMinutes), bufferMinutes: Number(v.bufferMinutes),
      bookAheadDays: Number(v.bookAheadDays), minNoticeMinutes: Number(v.minNoticeMinutes), closures: [],
    };
    this.saving.set(true);
    this.error.set(null);
    this.settingsService.save('booking', draft).pipe(finalize(() => this.saving.set(false))).subscribe({
      next: saved => {
        this.fill(saved.booking);
        this.version.update(n => n + 1);
        this.alert.success('Hours saved. New slots follow them; bookings already made stay where they are.');
      },
      error: e => this.error.set(errorMessage(e)),
    });
  }

  private setWeekly(day: number, time: string, open: boolean, done?: () => void): void {
    this.busy.set(`${day}-${time}`);
    this.boardError.set(null);
    this.bookingService.setWeeklySlot(day, time, open).pipe(finalize(() => this.busy.set(null))).subscribe({
      next: board => {
        this.board.set(board);
        done?.();
      },
      error: e => this.boardError.set(errorMessage(e)),
    });
  }

  private fill(b: BookingSettings): void {
    this.hours.clear({ emitEvent: false });
    for (const h of b.hours) {
      const group: DayGroup = this.fb.group({ open: [h.open], opens: [h.opens], closes: [h.closes], breakFrom: [h.breakFrom ?? ''], breakTo: [h.breakTo ?? ''] });
      this.syncDay(group);
      this.hours.push(group, { emitEvent: false });
    }
    this.form.reset({ hours: this.hours.getRawValue(), slotStepMinutes: b.slotStepMinutes, bufferMinutes: b.bufferMinutes, bookAheadDays: b.bookAheadDays, minNoticeMinutes: b.minNoticeMinutes });
    if (!this.canEdit()) this.form.disable({ emitEvent: false });
    this.error.set(null);
  }

  /** Times are off on closed days. */
  private syncDay(group: DayGroup): void {
    const { opens, closes, breakFrom, breakTo } = group.controls;
    for (const c of [opens, closes, breakFrom, breakTo]) {
      if (group.controls.open.value) c.enable({ emitEvent: false });
      else c.disable({ emitEvent: false });
    }
  }
}
