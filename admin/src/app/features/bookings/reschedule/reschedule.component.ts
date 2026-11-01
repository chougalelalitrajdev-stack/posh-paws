import { Component, ChangeDetectionStrategy, inject, input, OnInit, output, signal } from '@angular/core';
import { finalize } from 'rxjs';
import { Booking } from '../../../core/models/booking.model';
import { DayAvailability } from '../../../core/models/calendar.model';
import { BookingService } from '../../../core/services/booking.service';
import { errorMessage } from '../../../core/utils/error.utils';
import { formatDuration, today } from '../../../core/utils/date.utils';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { SlotPickerComponent } from '../../../shared/components/slot-picker/slot-picker.component';

/** Move an upcoming booking to another free slot. */
@Component({
  selector: 'pp-reschedule',
  imports: [ModalComponent, SlotPickerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './reschedule.component.html',
  styleUrl: './reschedule.component.scss',
})
export class RescheduleComponent implements OnInit {
  private bookingService = inject(BookingService);

  readonly booking = input.required<Booking>();
  readonly closed = output<void>();
  readonly saved = output<Booking>();

  protected readonly formatDuration = formatDuration;
  protected days = signal<DayAvailability[]>([]);
  protected loading = signal(true);
  protected date = signal<string | null>(null);
  protected time = signal<string | null>(null);
  protected saving = signal(false);
  protected error = signal<string | null>(null);

  ngOnInit(): void {
    this.date.set(this.booking().date);
    this.loadSlots();
  }

  save(): void {
    const date = this.date();
    const time = this.time();
    if (!date || !time || this.saving()) return;
    this.saving.set(true);
    this.error.set(null);
    this.bookingService.reschedule(this.booking().id, date, time).pipe(finalize(() => this.saving.set(false))).subscribe({
      next: b => this.saved.emit(b),
      error: e => {
        // Usually 409: the slot was just taken. Show fresh times.
        this.error.set(errorMessage(e));
        this.time.set(null);
        this.loadSlots();
      },
    });
  }

  private loadSlots(): void {
    const b = this.booking();
    if (!b.service) return;
    this.loading.set(true);
    this.bookingService.slots(b.service.id, today(), 14, b.id).pipe(finalize(() => this.loading.set(false))).subscribe(days => this.days.set(days));
  }
}
