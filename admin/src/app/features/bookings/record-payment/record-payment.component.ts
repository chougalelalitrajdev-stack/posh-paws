import { Component, ChangeDetectionStrategy, OnInit, inject, input, output, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { PAYMENT_METHODS } from '../../../core/constants/status.constants';
import { Booking, NewShopPayment } from '../../../core/models/booking.model';
import { BookingService } from '../../../core/services/booking.service';
import { SettingsService } from '../../../core/services/settings.service';
import { errorMessage } from '../../../core/utils/error.utils';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { InrPipe } from '../../../shared/pipes/inr.pipe';

type ShopMethod = NewShopPayment['method'];
const METHODS: ShopMethod[] = ['upi_qr', 'cash', 'card'];

/** Money taken at the shop: by the shop's UPI QR, cash or card, up to the balance. */
@Component({
  selector: 'pp-record-payment',
  imports: [ReactiveFormsModule, ModalComponent, InrPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './record-payment.component.html',
  styleUrl: './record-payment.component.scss',
})
export class RecordPaymentComponent implements OnInit {
  private bookingService = inject(BookingService);
  protected settings = inject(SettingsService);

  readonly booking = input.required<Booking>();
  readonly closed = output<void>();
  readonly saved = output<Booking>();

  protected readonly methods = METHODS.map(value => ({ value, label: PAYMENT_METHODS[value] }));
  protected form = inject(NonNullableFormBuilder).group({
    amountRupees: [0, [Validators.required, Validators.min(1)]],
    method: ['upi_qr' as ShopMethod],
  });
  protected saving = signal(false);
  protected error = signal<string | null>(null);

  ngOnInit(): void {
    this.settings.load().subscribe();
    this.form.controls.amountRupees.setValue((this.booking().bill?.balancePaise ?? 0) / 100);
  }

  save(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.saving.set(true);
    this.error.set(null);
    this.bookingService.recordPayment(this.booking().id, { amountPaise: Math.round(Number(v.amountRupees) * 100), method: v.method })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({ next: b => this.saved.emit(b), error: e => this.error.set(errorMessage(e)) });
  }
}
