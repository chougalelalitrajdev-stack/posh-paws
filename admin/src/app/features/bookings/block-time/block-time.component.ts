import { Component, ChangeDetectionStrategy, inject, input, OnInit, output, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { BookingService } from '../../../core/services/booking.service';
import { CatalogService } from '../../../core/services/catalog.service';
import { AlertService } from '../../../core/services/alert.service';
import { errorMessage } from '../../../core/utils/error.utils';
import { formatDuration, timeFromMinutes, today } from '../../../core/utils/date.utils';
import { ModalComponent } from '../../../shared/components/modal/modal.component';

/** "Block time" dialog on the calendar: keeps a station free (meeting, maintenance, leave). */
@Component({
  selector: 'pp-block-time',
  imports: [ReactiveFormsModule, ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './block-time.component.html',
  styleUrl: './block-time.component.scss',
})
export class BlockTimeComponent implements OnInit {
  private bookingService = inject(BookingService);
  private alert = inject(AlertService);
  protected catalog = inject(CatalogService);

  /** Day the calendar is showing; the form starts there. */
  readonly date = input(today());
  readonly closed = output<void>();
  readonly saved = output<void>();

  protected readonly times = Array.from({ length: 20 }, (_, i) => timeFromMinutes(9 * 60 + i * 30));
  protected readonly durations = [15, 30, 45, 60, 90, 120, 180, 240].map(m => ({ value: m, label: formatDuration(m) }));
  protected readonly minDate = today();

  protected form = inject(NonNullableFormBuilder).group({
    stationId: ['', Validators.required],
    date: ['', Validators.required],
    time: ['10:00', Validators.required],
    durationMinutes: [60, Validators.required],
    reason: [''],
  });
  protected saving = signal(false);
  protected error = signal<string | null>(null);

  ngOnInit(): void {
    this.form.patchValue({ date: this.date(), stationId: this.catalog.stations()[0]?.id ?? '' });
  }

  async save(): Promise<void> {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    try {
      const v = this.form.getRawValue();
      await this.bookingService.addBlock({ ...v, durationMinutes: Number(v.durationMinutes), reason: v.reason.trim() || 'Blocked' });
      this.alert.success('Time blocked.');
      this.saved.emit();
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.saving.set(false);
    }
  }
}
