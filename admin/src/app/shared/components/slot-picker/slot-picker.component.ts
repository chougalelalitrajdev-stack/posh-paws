import { Component, ChangeDetectionStrategy, computed, input, model } from '@angular/core';
import { DayAvailability } from '../../../core/models/calendar.model';
import { parseIsoDate, today, weekday } from '../../../core/utils/date.utils';

/** Pick a day (with its number of free slots) and then a start time. Used by New booking and Reschedule. */
@Component({
  selector: 'pp-slot-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './slot-picker.component.html',
  styleUrl: './slot-picker.component.scss',
})
export class SlotPickerComponent {
  readonly days = input.required<DayAvailability[]>();
  readonly loading = input(false);
  readonly date = model<string | null>(null);
  readonly time = model<string | null>(null);

  protected tiles = computed(() =>
    this.days().map(d => ({
      date: d.date,
      dow: d.date === today() ? 'Today' : weekday(d.date),
      num: parseIsoDate(d.date).getDate(),
      free: d.slots.filter(s => s.available).length,
    })),
  );
  protected selected = computed(() => this.days().find(d => d.date === this.date()) ?? null);
  protected freeOnSelected = computed(() => this.selected()?.slots.filter(s => s.available).length ?? 0);

  pickDate(date: string): void {
    if (date === this.date()) return;
    this.date.set(date);
    this.time.set(null);
  }
}
