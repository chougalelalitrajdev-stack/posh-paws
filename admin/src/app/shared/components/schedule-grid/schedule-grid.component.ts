import { Component, ChangeDetectionStrategy, computed, input, output } from '@angular/core';
import { Tone } from '../../../core/constants/status.constants';
import { minutesOfDay, timeFromMinutes } from '../../../core/utils/date.utils';

export interface ScheduleItem {
  id: string;
  /** HH:mm */
  time: string;
  durationMinutes: number;
  title: string;
  subtitle?: string;
  /** 'block' draws the striped break/blocked style. */
  tone: Tone | 'block';
  /** Blocks staff added can be clicked (to remove); lunch can't. */
  clickable: boolean;
  /** Side-by-side lanes inside one column (week view: one lane per station). */
  lane?: number;
  lanes?: number;
}

export interface ScheduleColumn {
  key: string;
  label: string;
  items: ScheduleItem[];
}

/** Pixels per 30 minutes (design: 96px per hour). */
const HALF_HOUR_PX = 48;

/** Time-grid calendar: one column per station (day view) or per day (week view). */
@Component({
  selector: 'pp-schedule-grid',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './schedule-grid.component.html',
  styleUrl: './schedule-grid.component.scss',
})
export class ScheduleGridComponent {
  readonly columns = input.required<ScheduleColumn[]>();
  readonly opens = input('09:00');
  readonly closes = input('19:00');
  /** Minimum column width in px, so week view scrolls sideways on phones. */
  readonly minColumnWidth = input(220);
  /** Narrow columns (week view): show only the title on one line; the block's position shows the time. */
  readonly compact = input(false);
  readonly select = output<ScheduleItem>();

  protected hours = computed(() => {
    const list: string[] = [];
    for (let m = minutesOfDay(this.opens()); m < minutesOfDay(this.closes()); m += 60) list.push(timeFromMinutes(m));
    return list;
  });
  protected height = computed(() => ((minutesOfDay(this.closes()) - minutesOfDay(this.opens())) / 30) * HALF_HOUR_PX);

  protected place(item: ScheduleItem): Record<string, string> {
    const top = ((minutesOfDay(item.time) - minutesOfDay(this.opens())) / 30) * HALF_HOUR_PX;
    const lanes = item.lanes ?? 1;
    const lane = item.lane ?? 0;
    return {
      top: `${top + 2}px`,
      height: `${Math.max((item.durationMinutes / 30) * HALF_HOUR_PX - 4, 22)}px`,
      left: `calc(${(lane / lanes) * 100}% + 4px)`,
      width: `calc(${100 / lanes}% - 8px)`,
    };
  }
}
