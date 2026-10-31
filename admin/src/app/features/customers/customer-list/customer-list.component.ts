import { Component, ChangeDetectionStrategy, computed, effect, inject, input, linkedSignal, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Customer, CustomerFilters, CustomerSegment, CustomerSummary } from '../../../core/models/customer.model';
import { Paged } from '../../../core/models/paged.model';
import { CustomerService } from '../../../core/services/customer.service';
import { formatPhone } from '../../../core/utils/contact.utils';
import { downloadCsv } from '../../../core/utils/csv.utils';
import { dayLabel, shortDate } from '../../../core/utils/date.utils';
import { formatInr } from '../../../core/utils/money.utils';
import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';
import { FilterTab, FilterTabsComponent } from '../../../shared/components/filter-tabs/filter-tabs.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';
import { StatusPillComponent } from '../../../shared/components/status-pill/status-pill.component';
import { InrPipe } from '../../../shared/pipes/inr.pipe';
import { CustomerDialogComponent } from '../customer-dialog/customer-dialog.component';

const PAGE_SIZE = 10;
const SEGMENTS: { key: CustomerSegment; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'members', label: 'Members' },
  { key: 'new', label: 'New this month' },
  { key: 'lapsed', label: 'Not seen in 90 days' },
  { key: 'no_plan', label: 'No plan' },
];

/** Everyone who has booked, asked for a callback or joined a plan (design: "Customers"). */
@Component({
  selector: 'pp-customer-list',
  imports: [
    RouterLink, PageHeaderComponent, FilterTabsComponent, PaginationComponent, StatusPillComponent,
    AvatarComponent, CustomerDialogComponent, InrPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './customer-list.component.html',
  styleUrl: './customer-list.component.scss',
})
export class CustomerListComponent {
  private customerService = inject(CustomerService);
  private router = inject(Router);

  /** Query param from the top-bar search ("See all matches"). */
  readonly q = input<string>();

  protected readonly formatPhone = formatPhone;
  protected readonly shortDate = shortDate;
  protected readonly planTones: Record<string, 'draft' | 'success' | 'warn'> = { Basic: 'draft', Posh: 'success', Royal: 'warn' };

  protected query = linkedSignal(() => this.q() ?? '');
  protected segment = signal<CustomerSegment>('all');
  protected plan = signal('');
  protected petType = signal<'' | 'dog' | 'cat'>('');
  protected sort = signal<NonNullable<CustomerFilters['sort']>>('last_visit');
  protected page = signal(1);
  protected result = signal<Paged<CustomerSummary> | null>(null);
  protected loading = signal(true);
  protected counts = signal<Record<CustomerSegment, number> | null>(null);
  protected adding = signal(false);

  protected tabs = computed<FilterTab[]>(() => SEGMENTS.map(s => ({ ...s, count: this.counts()?.[s.key] ?? null })));

  private filters = computed<CustomerFilters>(() => ({
    q: this.query() || undefined,
    segment: this.segment(),
    plan: this.plan() || undefined,
    petType: this.petType() || undefined,
    sort: this.sort(),
    page: this.page(),
    pageSize: PAGE_SIZE,
  }));

  constructor() {
    void this.loadCounts();
    effect(() => {
      const filters = this.filters();
      untracked(() => void this.load(filters));
    });
  }

  protected nextText(c: CustomerSummary): string {
    if (!c.next) return '—';
    if (c.next.kind === 'request') return 'Request open';
    if (c.next.kind === 'draft') return 'Draft';
    return `${dayLabel(c.next.date!)} ${c.next.time}`;
  }

  setSegment(key: string): void {
    this.segment.set(key as CustomerSegment);
    this.page.set(1);
  }

  onFilter(e: Event, which: 'plan' | 'petType' | 'sort'): void {
    const value = (e.target as HTMLSelectElement).value;
    if (which === 'plan') this.plan.set(value);
    if (which === 'petType') this.petType.set(value as '' | 'dog' | 'cat');
    if (which === 'sort') this.sort.set(value as NonNullable<CustomerFilters['sort']>);
    this.page.set(1);
  }

  clearSearch(): void {
    this.query.set('');
    this.page.set(1);
    void this.router.navigate([], { queryParams: { q: null }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  onAdded(c: Customer): void {
    this.adding.set(false);
    void this.router.navigate(['/customers', c.id]);
  }

  /** Every customer matching the current filters, not just this page. */
  async exportCsv(): Promise<void> {
    const all = await this.customerService.list({ ...this.filters(), page: 1, pageSize: 10_000 });
    downloadCsv(
      'customers.csv',
      ['Name', 'Phone', 'Pets', 'Plan', 'Bookings', 'Spent', 'Last visit'],
      all.items.map(c => [c.name, formatPhone(c.phone), c.petNames.join(', '), c.planName ?? 'No plan', c.bookingsCount, formatInr(c.spentPaise), c.lastVisit ?? '']),
    );
  }

  private async load(filters: CustomerFilters): Promise<void> {
    this.loading.set(true);
    try {
      this.result.set(await this.customerService.list(filters));
    } finally {
      this.loading.set(false);
    }
  }

  private async loadCounts(): Promise<void> {
    this.counts.set(await this.customerService.counts());
  }
}
