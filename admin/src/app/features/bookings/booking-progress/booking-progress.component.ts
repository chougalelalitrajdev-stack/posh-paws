import { Component, ChangeDetectionStrategy, input } from '@angular/core';

export interface ProgressStep {
  label: string;
  state: 'done' | 'now' | 'later';
  /** When it happened, "Waiting" or "—". */
  time: string;
}

/** Request → Details → Link sent → Paid → Confirmed → Completed tracker on Booking detail. */
@Component({
  selector: 'pp-booking-progress',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './booking-progress.component.html',
  styleUrl: './booking-progress.component.scss',
})
export class BookingProgressComponent {
  readonly steps = input.required<ProgressStep[]>();
}
