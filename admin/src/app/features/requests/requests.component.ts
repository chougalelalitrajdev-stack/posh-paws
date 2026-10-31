import { Component, ChangeDetectionStrategy, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { URGENT_REQUEST_MINUTES } from '../../core/constants/app.constants';
import { CALL_OUTCOMES, SOURCES } from '../../core/constants/status.constants';
import { Booking } from '../../core/models/booking.model';
import { BookingService } from '../../core/services/booking.service';
import { formatPhone, telLink, whatsappLink } from '../../core/utils/contact.utils';
import { ageLabel, minutesSince, whenLabel } from '../../core/utils/date.utils';
import { FilterTab, FilterTabsComponent } from '../../shared/components/filter-tabs/filter-tabs.component';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { StatusPillComponent } from '../../shared/components/status-pill/status-pill.component';

/** Callback inbox: requests from the app and the phone, oldest first (design: "Requests on a phone"). */
@Component({
  selector: 'pp-requests',
  imports: [RouterLink, PageHeaderComponent, FilterTabsComponent, StatusPillComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './requests.component.html',
  styleUrl: './requests.component.scss',
})
export class RequestsComponent {
  private bookingService = inject(BookingService);

  protected readonly sources = SOURCES;
  protected readonly formatPhone = formatPhone;
  protected readonly telLink = telLink;
  protected readonly whatsappLink = whatsappLink;
  protected readonly ageLabel = ageLabel;
  protected readonly whenLabel = whenLabel;

  protected tab = signal('new');
  protected loading = signal(true);
  private requests = signal<Booking[]>([]);

  private oldestFirst = (a: Booking, b: Booking) => a.createdAt.localeCompare(b.createdAt);
  protected newOnes = computed(() => this.requests().filter(b => !b.request?.callOutcome).sort(this.oldestFirst));
  protected called = computed(() => this.requests().filter(b => !!b.request?.callOutcome).sort(this.oldestFirst));
  protected shown = computed(() => (this.tab() === 'new' ? this.newOnes() : this.called()));
  protected tabs = computed<FilterTab[]>(() => [
    { key: 'new', label: 'New', count: this.newOnes().length },
    { key: 'called', label: 'Called', count: this.called().length },
  ]);

  constructor() {
    void this.load();
  }

  protected urgent(b: Booking): boolean {
    return !b.request?.callOutcome && minutesSince(b.createdAt) > URGENT_REQUEST_MINUTES;
  }

  protected outcomeLabel(b: Booking): string {
    return CALL_OUTCOMES.find(o => o.value === b.request?.callOutcome)?.label ?? '';
  }

  private async load(): Promise<void> {
    try {
      const page = await this.bookingService.list({ stages: ['request'], pageSize: 200 });
      this.requests.set(page.items);
    } finally {
      this.loading.set(false);
    }
  }
}
