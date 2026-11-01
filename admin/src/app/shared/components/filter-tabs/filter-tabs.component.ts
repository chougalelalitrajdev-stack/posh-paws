import { Component, ChangeDetectionStrategy, input, model } from '@angular/core';

export interface FilterTab {
  key: string;
  label: string;
  count?: number | null;
}

/** Row of pill buttons with counts that filter a list (Bookings stages, Requests, ...). */
@Component({
  selector: 'pp-filter-tabs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './filter-tabs.component.html',
  styleUrl: './filter-tabs.component.scss',
})
export class FilterTabsComponent {
  readonly tabs = input.required<FilterTab[]>();
  readonly label = input('Filter');
  readonly value = model.required<string>();
}
