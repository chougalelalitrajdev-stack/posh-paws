import { Component, ChangeDetectionStrategy, computed, input } from '@angular/core';
import { BookingBill, PaymentEntry } from '../../../core/models/booking.model';
import { dateLabel, toIsoDate } from '../../../core/utils/date.utils';
import { InrPipe } from '../../pipes/inr.pipe';

const METHOD: Record<PaymentEntry['method'], string> = { online: 'online', upi_qr: 'by UPI at the shop', cash: 'in cash', card: 'by card' };

/**
 * A booking's bill: price, the one discount, total, then either what to pay now and at the shop (`mode="quote"`, before booking)
 * or every payment and what's still due (`mode="booking"`). The server works out every number.
 */
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
  readonly mode = input<'quote' | 'booking'>('booking');
  /** Cancelled or missed: nothing more is due. */
  readonly closed = input(false);

  protected rows = computed(() => this.payments().map(p => ({
    id: p.id,
    label: p.kind === 'refund' ? 'Advance refunded' : `${p.kind === 'advance' ? 'Advance paid' : 'Paid'} ${METHOD[p.method]}`,
    when: dateLabel(toIsoDate(new Date(p.at))),
    amountPaise: p.amountPaise,
    refund: p.kind === 'refund',
  })));

  protected finalLabel = computed(() => {
    const b = this.bill();
    if (this.closed()) return 'Nothing more to pay';
    if (b.balancePaise) return 'To pay at the shop';
    return b.totalPaise ? 'Paid in full' : 'Nothing to pay';
  });
}
