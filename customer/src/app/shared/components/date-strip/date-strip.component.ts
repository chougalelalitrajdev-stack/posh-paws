import { Component, ChangeDetectionStrategy, computed, input, model } from '@angular/core';
import { dateLongLabel, dateParts, toIsoDate } from '../../../core/utils/date.utils';

/**
 * Pick one day from a short run of dates (YYYY-MM-DD). Swipes sideways on
 * phones and tablets; lays out as a two-week calendar grid on desktop.
 */
@Component({
  selector: 'pp-date-strip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './date-strip.component.html',
  styleUrl: './date-strip.component.scss',
})
export class DateStripComponent {
  readonly dates = input.required<string[]>();
  readonly value = model<string | null>(null);

  protected readonly tiles = computed(() => {
    const today = toIsoDate(new Date());
    return this.dates().map(iso => ({ iso, isToday: iso === today, label: dateLongLabel(iso), ...dateParts(iso) }));
  });
}
