import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { ActivityEntry } from '../../../core/models/booking.model';
import { whenLabel } from '../../../core/utils/date.utils';

/** Timeline of what happened, newest first, with a coloured dot per kind. */
@Component({
  selector: 'pp-activity-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './activity-list.component.html',
  styleUrl: './activity-list.component.scss',
})
export class ActivityListComponent {
  readonly entries = input.required<ActivityEntry[]>();
  readonly emptyText = input('Nothing yet.');

  protected readonly whenLabel = whenLabel;
}
