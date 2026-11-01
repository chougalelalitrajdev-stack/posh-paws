import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';

/** One numbered section of the New booking flow: open, done (with a summary + Change) or not reached yet. */
@Component({
  selector: 'pp-booking-step',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './booking-step.component.html',
  styleUrl: './booking-step.component.scss',
  host: { '[class]': "'is-' + state()" },
})
export class BookingStepComponent {
  readonly number = input.required<number>();
  readonly title = input.required<string>();
  readonly state = input.required<'open' | 'done' | 'later'>();
  /** Shown next to the title once the step is done. */
  readonly summary = input('');
  readonly change = output<void>();
}
