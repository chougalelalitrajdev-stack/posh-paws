import { Component, ChangeDetectionStrategy, OnInit, inject, input, output, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { AlertService } from '../../../core/services/alert.service';
import { SettingsService } from '../../../core/services/settings.service';
import { longDate, today } from '../../../core/utils/date.utils';
import { errorMessage } from '../../../core/utils/error.utils';
import { ModalComponent } from '../../../shared/components/modal/modal.component';

/** Add a holiday: closed all day, or closing early. With `date`, it's for that day only (Day › Close this whole day). */
@Component({
  selector: 'pp-holiday-dialog',
  imports: [ReactiveFormsModule, ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './holiday-dialog.component.html',
  styleUrl: './holiday-dialog.component.scss',
})
export class HolidayDialogComponent implements OnInit {
  private settingsService = inject(SettingsService);
  private alert = inject(AlertService);

  /** Fixed date, or null to let staff pick one. */
  readonly date = input<string | null>(null);
  readonly closed = output<void>();
  readonly saved = output<void>();

  protected readonly today = today();
  protected readonly longDate = longDate;
  protected saving = signal(false);
  protected error = signal<string | null>(null);
  protected form = inject(NonNullableFormBuilder).group({
    date: ['', Validators.required],
    name: ['', Validators.required],
    allDay: [true],
    closesAt: ['14:00'],
  });

  ngOnInit(): void {
    if (this.date()) this.form.controls.date.setValue(this.date()!);
  }

  save(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.saving.set(true);
    this.error.set(null);
    this.settingsService.addClosure({ date: v.date, name: v.name, closesAt: v.allDay ? null : v.closesAt })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: s => {
          const n = s.booking.closures.find(c => c.date === v.date)?.affectedBookings ?? 0;
          this.alert.success(n ? `${v.name} added. ${n} booking${n === 1 ? '' : 's'} on that day still need moving.` : `${v.name} added. Customers can't book then.`);
          this.saved.emit();
        },
        error: e => this.error.set(errorMessage(e)),
      });
  }
}
