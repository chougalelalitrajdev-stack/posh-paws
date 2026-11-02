import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { PAYMENT_METHODS } from '../../../core/constants/status.constants';
import { BookingBill, PaymentEntry } from '../../../core/models/booking.model';
import { whenLabel } from '../../../core/utils/date.utils';
import { InrPipe } from '../../pipes/inr.pipe';

const KIND: Record<PaymentEntry['kind'], string> = { advance: 'Advance', balance: 'Paid', refund: 'Refunded' };

/** A booking's bill as the server worked it out: price, the one discount, total, payments and balance. */
@Component({
  selector: 'pp-bill',
  imports: [InrPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './bill.component.html',
  styleUrl: './bill.component.scss',
})
export class BillComponent {
  readonly bill = input.required<BookingBill>();
  readonly payments = input<PaymentEntry[]>([]);
  /** Hide the balance line (e.g. on a cancelled booking, where nothing more is due). */
  readonly showBalance = input(true);

  protected readonly whenLabel = whenLabel;

  protected label(p: PaymentEntry): string {
    return `${KIND[p.kind]} · ${PAYMENT_METHODS[p.method]}`;
  }
}
