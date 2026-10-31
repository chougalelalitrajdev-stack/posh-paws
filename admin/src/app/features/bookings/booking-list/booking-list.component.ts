import { Component, ChangeDetectionStrategy, computed, effect, inject, input, linkedSignal, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { BOOKING_TABS, PAYMENT_STATUSES, STAGES } from '../../../core/constants/status.constants';
import { Booking, BookingFilters, PaymentStatus } from '../../../core/models/booking.model';
import { CalendarData } from '../../../core/models/calendar.model';
import { PetType } from '../../../core/models/catalog.model';
import { Paged } from '../../../core/models/paged.model';
import { BookingService } from '../../../core/services/booking.service';
import { CatalogService } from '../../../core/services/catalog.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import { formatPhone } from '../../../core/utils/contact.utils';
import { addDays, dateRange, dayLabel, shortDate, today, whenLabel } from '../../../core/utils/date.utils';
import { FilterTab, FilterTabsComponent } from '../../../shared/components/filter-tabs/filter-tabs.component';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';
import { ScheduleColumn, ScheduleGridComponent, ScheduleItem } from '../../../shared/components/schedule-grid/schedule-grid.component';
import { SegmentedComponent } from '../../../shared/components/segmented/segmented.component';
import { StatusPillComponent } from '../../../shared/components/status-pill/status-pill.component';
import { BlockTimeComponent } from '../block-time/block-time.component';

const PAGE_SIZE = 10;

/** Bookings as a filterable list or a day/week calendar (design: "Bookings (list + calendar)"). */
@Component({
  selector: 'pp-booking-list',
  imports: [
    RouterLink, PageHeaderComponent, FilterTabsComponent, SegmentedComponent, PaginationComponent,
    StatusPillComponent, ScheduleGridComponent, IconComponent, BlockTimeComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './booking-list.component.html',
  styleUrl: './booking-list.component.scss',
})
export class BookingListComponent {
  private bookingService = inject(BookingService);
  private confirm = inject(ConfirmService);
  private router = inject(Router);
  protected catalog = inject(CatalogService);

  /** Query params, so dashboard links can open a tab or the calendar. */
  readonly stage = input<string>();
  readonly view = input<string>();

  protected readonly viewOptions = [{ value: 'list', label: 'List' }, { value: 'calendar', label: 'Calendar' }];
  protected readonly calOptions = [{ value: 'day', label: 'Day' }, { value: 'week', label: 'Week' }];
  protected readonly paymentOptions = Object.entries(PAYMENT_STATUSES).map(([value, p]) => ({ value: value as PaymentStatus, label: p.label }));
  protected readonly formatPhone = formatPhone;
  protected readonly whenLabel = whenLabel;

  // ── List ──
  protected mode = linkedSignal(() => (this.view() === 'calendar' ? 'calendar' : 'list'));
  protected tab = linkedSignal(() => (BOOKING_TABS.some(t => t.key === this.stage()) ? this.stage()! : 'all'));
  protected range = signal<NonNullable<BookingFilters['range']>>('any');
  protected serviceId = signal('');
  protected petType = signal<PetType | ''>('');
  protected paymentStatus = signal<PaymentStatus | ''>('');
  protected page = signal(1);
  protected result = signal<Paged<Booking> | null>(null);
  protected loading = signal(true);

  protected tabs = computed<FilterTab[]>(() => {
    const counts = this.bookingService.counts();
    return BOOKING_TABS.map(t => ({
      key: t.key,
      label: t.label,
      count: !counts ? null : t.stages.length ? t.stages.reduce((n, s) => n + counts[s], 0) : Object.values(counts).reduce((a, b) => a + b, 0),
    }));
  });

  // ── Calendar ──
  protected calView = signal('day');
  protected calDate = signal(today());
  protected calendar = signal<CalendarData | null>(null);
  protected blockOpen = signal(false);

  protected calTitle = computed(() =>
    this.calView() === 'day'
      ? `${dayLabel(this.calDate())}${this.calDate() === today() ? ` · ${shortDate(this.calDate())}` : ''}`
      : `${shortDate(this.calDate())} – ${shortDate(addDays(this.calDate(), 6))}`,
  );

  protected columns = computed<ScheduleColumn[]>(() => {
    const cal = this.calendar();
    if (!cal) return [];
    const stationIndex = (id: string | null) => Math.max(0, cal.stations.findIndex(s => s.id === id));
    const lanes = cal.stations.length;
    const bookingItem = (b: Booking, week: boolean): ScheduleItem => ({
      id: b.id, time: b.time!, durationMinutes: b.service?.durationMinutes ?? 30, clickable: true,
      title: b.pet?.name ?? b.customer.name, subtitle: b.service?.name, tone: STAGES[b.stage].tone,
      ...(week && { lane: stationIndex(b.stationId), lanes }),
    });
    const blockItem = (blk: CalendarData['blocks'][number], week: boolean): ScheduleItem => ({
      id: blk.id, time: blk.time, durationMinutes: blk.durationMinutes, clickable: !blk.fixed,
      title: blk.reason, tone: 'block', ...(week && { lane: stationIndex(blk.stationId), lanes }),
    });

    if (this.calView() === 'day') {
      return cal.stations.map(st => ({
        key: st.id,
        label: st.name,
        items: [
          ...cal.blocks.filter(b => b.stationId === st.id && b.date === this.calDate()).map(b => blockItem(b, false)),
          ...cal.bookings.filter(b => b.stationId === st.id && b.date === this.calDate()).map(b => bookingItem(b, false)),
        ],
      }));
    }
    return dateRange(this.calDate(), 7).map(date => {
      // Lunch is the same on every station, so it shows once across the whole day.
      const seen = new Set<string>();
      const blocks = cal.blocks.filter(b => b.date === date).flatMap(b => {
        if (!b.fixed) return [blockItem(b, true)];
        const key = `${b.time}-${b.reason}`;
        if (seen.has(key)) return [];
        seen.add(key);
        return [blockItem(b, false)];
      });
      return {
      key: date,
      label: dayLabel(date),
      items: [
        ...blocks,
        ...cal.bookings.filter(b => b.date === date).map(b => bookingItem(b, true)),
      ],
      };
    });
  });

  constructor() {
    void this.catalog.load();
    void this.bookingService.refreshCounts();

    effect(() => {
      const filters: BookingFilters = {
        stages: BOOKING_TABS.find(t => t.key === this.tab())?.stages,
        range: this.range(),
        serviceId: this.serviceId() || undefined,
        petType: this.petType() || undefined,
        paymentStatus: this.paymentStatus() || undefined,
        page: this.page(),
        pageSize: PAGE_SIZE,
      };
      if (this.mode() === 'list') untracked(() => void this.loadList(filters));
    });

    effect(() => {
      const from = this.calDate();
      const days = this.calView() === 'day' ? 1 : 7;
      if (this.mode() === 'calendar') untracked(() => void this.loadCalendar(from, days));
    });
  }

  // Any filter change goes back to the first page.
  onRange(e: Event): void {
    this.range.set(this.selectValue(e) as NonNullable<BookingFilters['range']>);
    this.page.set(1);
  }

  onService(e: Event): void {
    this.serviceId.set(this.selectValue(e));
    this.page.set(1);
  }

  onPetType(e: Event): void {
    this.petType.set(this.selectValue(e) as PetType | '');
    this.page.set(1);
  }

  onPayment(e: Event): void {
    this.paymentStatus.set(this.selectValue(e) as PaymentStatus | '');
    this.page.set(1);
  }

  setTab(key: string): void {
    this.tab.set(key);
    this.page.set(1);
  }

  moveCalendar(direction: 1 | -1): void {
    this.calDate.update(d => addDays(d, direction * (this.calView() === 'day' ? 1 : 7)));
  }

  protected isToday = computed(() => this.calDate() === today());
  goToday(): void {
    this.calDate.set(today());
  }

  async onSelect(item: ScheduleItem): Promise<void> {
    if (item.tone !== 'block') {
      void this.router.navigate(['/bookings', item.id]);
      return;
    }
    const ok = await this.confirm.ask({
      title: 'Remove this block?',
      message: `${item.title} at ${item.time} becomes bookable again.`,
      confirmLabel: 'Remove block',
      tone: 'danger',
    });
    if (!ok) return;
    await this.bookingService.removeBlock(item.id);
    await this.loadCalendar(this.calDate(), this.calView() === 'day' ? 1 : 7);
  }

  onBlockSaved(): void {
    this.blockOpen.set(false);
    void this.loadCalendar(this.calDate(), this.calView() === 'day' ? 1 : 7);
  }

  protected slotText(b: Booking): string {
    if (b.date && b.time) return `${dayLabel(b.date)} · ${b.time}`;
    if (b.stage === 'request') return `Wants: ${b.request?.bestTime ?? 'any time'}`;
    return 'Not picked';
  }

  /** The row's main action depends on where the booking is. */
  protected cta(b: Booking): { label: string; link: string[]; query: Record<string, string> | null; primary: boolean } {
    if (b.stage === 'request') return { label: 'Start booking', link: ['/bookings/new'], query: { from: b.id }, primary: true };
    if (b.stage === 'draft') return { label: 'Continue', link: ['/bookings/new'], query: { from: b.id }, primary: true };
    if (b.stage === 'awaiting_payment' && b.paymentStatus === 'failed') return { label: 'New link', link: ['/bookings', b.id], query: null, primary: true };
    if (b.stage === 'awaiting_payment') return { label: 'Resend link', link: ['/bookings', b.id], query: null, primary: false };
    return { label: 'View', link: ['/bookings', b.id], query: null, primary: false };
  }

  private selectValue(e: Event): string {
    return (e.target as HTMLSelectElement).value;
  }

  private async loadList(filters: BookingFilters): Promise<void> {
    this.loading.set(true);
    try {
      this.result.set(await this.bookingService.list(filters));
    } finally {
      this.loading.set(false);
    }
  }

  private async loadCalendar(from: string, days: number): Promise<void> {
    this.calendar.set(await this.bookingService.calendar(from, days));
  }
}
