import { Component, ChangeDetectionStrategy, computed, inject, signal } from '@angular/core';
import { FormArray, FormControl, FormGroup, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { BookingSettings, Closure, DayHours } from '../../../core/models/settings.model';
import { AlertService } from '../../../core/services/alert.service';
import { CatalogService } from '../../../core/services/catalog.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import { SettingsService } from '../../../core/services/settings.service';
import { longDate, today } from '../../../core/utils/date.utils';
import { errorMessage } from '../../../core/utils/error.utils';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
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

/** Settings › Booking & availability: opening hours, slot rules and closures. The backend offers slots by these. */
@Component({
  selector: 'pp-booking-settings',
  imports: [ReactiveFormsModule, RouterLink, ModalComponent, SwitchComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './booking-settings.component.html',
  styleUrl: './booking-settings.component.scss',
})
export class BookingSettingsComponent {
  private settingsService = inject(SettingsService);
  private confirm = inject(ConfirmService);
  private alert = inject(AlertService);
  private fb = inject(NonNullableFormBuilder);
  protected catalog = inject(CatalogService);

  protected readonly days = DAYS;
  protected readonly options = OPTIONS;
  protected readonly longDate = longDate;
  protected readonly today = today();
  protected saving = signal(false);
  protected error = signal<string | null>(null);

  protected form = this.fb.group({
    hours: this.fb.array<DayGroup>([]),
    slotStepMinutes: [30],
    bufferMinutes: [15],
    bookAheadDays: [30],
    minNoticeMinutes: [30],
  });

  protected closures = computed(() => this.settingsService.settings()?.booking.closures ?? []);
  protected stations = computed(() => this.catalog.stations().map(s => s.name).join(', '));

  // Add closure dialog
  protected closureOpen = signal(false);
  protected closureError = signal<string | null>(null);
  protected addingClosure = signal(false);
  protected closureForm = this.fb.group({
    date: ['', Validators.required],
    name: ['', Validators.required],
    allDay: [true],
    closesAt: ['14:00'],
  });

  constructor() {
    void this.catalog.load();
    const s = this.settingsService.settings();
    if (s) this.fill(s.booking);
  }

  get hours(): FormArray<DayGroup> {
    return this.form.controls.hours;
  }

  dirty(): boolean {
    return this.form.dirty;
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

  async save(): Promise<void> {
    if (this.saving()) return;
    const v = this.form.getRawValue();
    const draft: BookingSettings = {
      hours: v.hours.map((h, day): DayHours => ({ day, open: h.open, opens: h.opens, closes: h.closes, breakFrom: h.breakFrom || null, breakTo: h.breakTo || null })),
      slotStepMinutes: Number(v.slotStepMinutes), bufferMinutes: Number(v.bufferMinutes),
      bookAheadDays: Number(v.bookAheadDays), minNoticeMinutes: Number(v.minNoticeMinutes), closures: [],
    };
    this.saving.set(true);
    this.error.set(null);
    try {
      const saved = await this.settingsService.save('booking', draft);
      this.fill(saved.booking);
      this.alert.success('Booking rules saved. New slots follow them; bookings already made stay where they are.');
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.saving.set(false);
    }
  }

  openClosure(): void {
    this.closureForm.reset({ date: '', name: '', allDay: true, closesAt: '14:00' });
    this.closureError.set(null);
    this.closureOpen.set(true);
  }

  async addClosure(): Promise<void> {
    if (this.closureForm.invalid || this.addingClosure()) {
      this.closureForm.markAllAsTouched();
      return;
    }
    const v = this.closureForm.getRawValue();
    this.addingClosure.set(true);
    this.closureError.set(null);
    try {
      const saved = await this.settingsService.addClosure({ date: v.date, name: v.name, closesAt: v.allDay ? null : v.closesAt });
      const added = saved.booking.closures.find(c => c.date === v.date);
      this.closureOpen.set(false);
      const n = added?.affectedBookings ?? 0;
      this.alert.success(n ? `${v.name} added. ${n} booking${n === 1 ? '' : 's'} on that day still need moving.` : `${v.name} added. No slots are offered then.`);
    } catch (e) {
      this.closureError.set(errorMessage(e));
    } finally {
      this.addingClosure.set(false);
    }
  }

  async removeClosure(c: Closure): Promise<void> {
    const ok = await this.confirm.ask({
      title: `Remove ${c.name}?`, message: `Slots open again on ${longDate(c.date)}.`, confirmLabel: 'Remove closure', tone: 'danger',
    });
    if (!ok) return;
    await this.settingsService.removeClosure(c.id);
    this.alert.success(`${c.name} removed.`);
  }

  protected closureLabel(c: Closure): string {
    return c.closesAt ? `Closing at ${c.closesAt}` : 'Closed all day';
  }

  private fill(b: BookingSettings): void {
    this.hours.clear({ emitEvent: false });
    for (const h of b.hours) {
      const group: DayGroup = this.fb.group({ open: [h.open], opens: [h.opens], closes: [h.closes], breakFrom: [h.breakFrom ?? ''], breakTo: [h.breakTo ?? ''] });
      this.syncDay(group);
      this.hours.push(group, { emitEvent: false });
    }
    this.form.reset({ hours: this.hours.getRawValue(), slotStepMinutes: b.slotStepMinutes, bufferMinutes: b.bufferMinutes, bookAheadDays: b.bookAheadDays, minNoticeMinutes: b.minNoticeMinutes });
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
