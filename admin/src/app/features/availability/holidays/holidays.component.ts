import { Component, ChangeDetectionStrategy, computed, inject, output, signal } from '@angular/core';
import { Closure } from '../../../core/models/settings.model';
import { AlertService } from '../../../core/services/alert.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import { SettingsService } from '../../../core/services/settings.service';
import { longDate } from '../../../core/utils/date.utils';
import { HolidayDialogComponent } from '../holiday-dialog/holiday-dialog.component';

/** Availability › Holidays: days closed all day or closing early. Any staff member can add or remove them. */
@Component({
  selector: 'pp-holidays',
  imports: [HolidayDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './holidays.component.html',
  styleUrl: './holidays.component.scss',
})
export class HolidaysComponent {
  private settingsService = inject(SettingsService);
  private confirm = inject(ConfirmService);
  private alert = inject(AlertService);

  /** Show this date on the Day tab. */
  readonly openDay = output<string>();

  protected readonly longDate = longDate;
  protected adding = signal(false);
  protected holidays = computed(() => this.settingsService.settings()?.booking.closures ?? []);

  constructor() {
    this.settingsService.load().subscribe();
  }

  protected kind(c: Closure): string {
    return c.closesAt ? `Closing at ${c.closesAt}` : 'Closed all day';
  }

  async remove(c: Closure): Promise<void> {
    const ok = await this.confirm.ask({
      title: `Remove ${c.name}?`, message: `Customers can book ${longDate(c.date)} again.`, confirmLabel: 'Remove holiday', tone: 'danger',
    });
    if (ok) this.settingsService.removeClosure(c.id).subscribe(() => this.alert.success(`${c.name} removed.`));
  }
}
