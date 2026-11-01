import { Component, ChangeDetectionStrategy, computed, input } from '@angular/core';
import { PAYMENT_STATUSES, STAGES, Tone } from '../../../core/constants/status.constants';
import { BookingStage, PaymentStatus } from '../../../core/models/booking.model';

/**
 * Coloured status pill. Give it a booking `stage` or `payment` status,
 * or any `label` + `tone`. `dot` adds the small leading dot used for stages.
 */
@Component({
  selector: 'pp-status-pill',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './status-pill.component.html',
  styleUrl: './status-pill.component.scss',
})
export class StatusPillComponent {
  readonly stage = input<BookingStage>();
  readonly payment = input<PaymentStatus>();
  readonly label = input<string>();
  readonly tone = input<Tone>('neutral');
  readonly dot = input(false);

  protected info = computed(() => {
    const stage = this.stage();
    const payment = this.payment();
    if (stage) return STAGES[stage];
    if (payment) return PAYMENT_STATUSES[payment];
    return { label: this.label() ?? '', tone: this.tone() };
  });
}
