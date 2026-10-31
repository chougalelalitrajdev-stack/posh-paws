import { Component, ChangeDetectionStrategy, computed, input, model } from '@angular/core';
import { TimeSlot } from '../../../core/models/booking.model';
import { minutesOfDay, timeLabel } from '../../../core/utils/date.utils';

const PERIODS = [
  { name: 'Morning', icon: '🌤️', until: 12 * 60 },
  { name: 'Afternoon', icon: '☀️', until: 17 * 60 },
  { name: 'Evening', icon: '🌙', until: 24 * 60 },
];

/** Start-time picker grouped into morning / afternoon / evening. Taken slots show but can't be picked. */
@Component({
  selector: 'pp-slot-grid',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './slot-grid.component.html',
  styleUrl: './slot-grid.component.scss',
})
export class SlotGridComponent {
  readonly slots = input.required<TimeSlot[]>();
  readonly value = model<string | null>(null);

  protected readonly groups = computed(() => {
    let from = 0;
    return PERIODS.map(period => {
      const slots = this.slots()
        .filter(s => minutesOfDay(s.time) >= from && minutesOfDay(s.time) < period.until)
        .map(s => ({ ...s, label: timeLabel(s.time) }));
      from = period.until;
      return { ...period, slots, free: slots.filter(s => s.available).length };
    }).filter(g => g.slots.length > 0);
  });

  protected pick(slot: TimeSlot): void {
    if (slot.available) this.value.set(slot.time);
  }
}
