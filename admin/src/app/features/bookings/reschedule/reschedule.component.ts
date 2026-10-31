import { Component, ChangeDetectionStrategy, inject, input, OnInit, output, signal } from '@angular/core';
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
    void this.loadSlots();
  }

  async save(): Promise<void> {
    const date = this.date();
    const time = this.time();
    if (!date || !time || this.saving()) return;
    this.saving.set(true);
    this.error.set(null);
    try {
      this.saved.emit(await this.bookingService.reschedule(this.booking().id, date, time));
    } catch (e) {
      this.error.set(errorMessage(e));
      this.time.set(null);
      void this.loadSlots();
    } finally {
      this.saving.set(false);
    }
  }

  private async loadSlots(): Promise<void> {
    const b = this.booking();
    if (!b.service) return;
    this.loading.set(true);
    try {
      this.days.set(await this.bookingService.slots(b.service.id, today(), 14, b.id));
    } finally {
      this.loading.set(false);
    }
  }
}
