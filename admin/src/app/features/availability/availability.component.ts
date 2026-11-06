import { Component, ChangeDetectionStrategy, inject, input, linkedSignal, viewChild } from '@angular/core';
import { ConfirmService } from '../../core/services/confirm.service';
import { today } from '../../core/utils/date.utils';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { SegmentedComponent } from '../../shared/components/segmented/segmented.component';
import { DayComponent } from './day/day.component';
import { HolidaysComponent } from './holidays/holidays.component';
import { WeekComponent } from './week/week.component';

type View = 'week' | 'day' | 'holidays';
const VIEWS: { value: View; label: string }[] = [
  { value: 'week', label: 'Week' },
  { value: 'day', label: 'Day' },
  { value: 'holidays', label: 'Holidays' },
];

/**
 * Availability: everything about when customers can book. Strongest first: a holiday, that day's changes (Day),
 * the weekly pattern and opening hours (Week). Block time for one station stays on the Bookings calendar.
 */
@Component({
  selector: 'pp-availability',
  imports: [PageHeaderComponent, SegmentedComponent, WeekComponent, DayComponent, HolidaysComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './availability.component.html',
  styleUrl: './availability.component.scss',
})
export class AvailabilityComponent {
  private confirm = inject(ConfirmService);

  /** Query params, so links can open a tab and a date (?view=day&date=2026-11-10). */
  readonly view = input<string>();
  readonly date = input<string>();

  protected readonly views = VIEWS;
  protected current = linkedSignal<View>(() => (VIEWS.some(v => v.value === this.view()) ? (this.view() as View) : 'day'));
  protected day = linkedSignal(() => (/^\d{4}-\d{2}-\d{2}$/.test(this.date() ?? '') ? this.date()! : today()));
  /** The highlighted tab; snaps back to the current one if leaving is cancelled. */
  protected picked = linkedSignal<string>(() => this.current());

  private week = viewChild(WeekComponent);

  async show(view: string): Promise<void> {
    if (view === this.current()) return;
    if (this.week()?.dirty()) {
      const ok = await this.confirm.ask({
        title: 'Discard your changes?', message: 'You have unsaved changes to the opening hours.', confirmLabel: 'Discard', cancelLabel: 'Keep editing', tone: 'danger',
      });
      if (!ok) {
        this.picked.set(this.current());
        return;
      }
    }
    this.current.set(view as View);
  }

  openDay(date: string): void {
    this.day.set(date);
    this.current.set('day');
  }
}
