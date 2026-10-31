import { Component, ChangeDetectionStrategy, computed, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { OWNER_ROLES } from '../../core/constants/app.constants';
import { PAYMENT_STATES } from '../../core/constants/status.constants';
import { Paged } from '../../core/models/paged.model';
import { Payment, PaymentSummary, PaymentTab } from '../../core/models/payment.model';
import { AlertService } from '../../core/services/alert.service';
import { AuthService } from '../../core/services/auth.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { PaymentService } from '../../core/services/payment.service';
import { downloadCsv } from '../../core/utils/csv.utils';
import { addDays, parseIsoDate, toIsoDate, today, whenLabel } from '../../core/utils/date.utils';
import { formatInr } from '../../core/utils/money.utils';
import { FilterTab, FilterTabsComponent } from '../../shared/components/filter-tabs/filter-tabs.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { PaginationComponent } from '../../shared/components/pagination/pagination.component';
import { StatComponent } from '../../shared/components/stat/stat.component';
import { StatusPillComponent } from '../../shared/components/status-pill/status-pill.component';
import { InrPipe } from '../../shared/pipes/inr.pipe';

const PAGE_SIZE = 20;
const TABS: FilterTab[] = [
  { key: 'all', label: 'All' },
  { key: 'waiting', label: 'Waiting' },
  { key: 'paid', label: 'Paid' },
  { key: 'failed', label: 'Failed' },
  { key: 'refunded', label: 'Refunded' },
];
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** Periods the picker offers. The first (last 30 days) is the default, so the 1st of a month isn't empty. */
function periods(): { key: string; label: string; from: string; to: string }[] {
  const t = today();
  const month = (offset: number) => {
    const d = parseIsoDate(t);
    const first = new Date(d.getFullYear(), d.getMonth() + offset, 1);
    const last = new Date(d.getFullYear(), d.getMonth() + offset + 1, 0);
    return { label: first.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }), from: toIsoDate(first), to: toIsoDate(last) };
  };
  return [
    { key: '30', label: 'Last 30 days', from: addDays(t, -29), to: t },
    { key: '7', label: 'Last 7 days', from: addDays(t, -6), to: t },
    { key: 'this-month', ...month(0) },
    { key: 'last-month', ...month(-1) },
  ];
}

/** Every payment link and what happened to it (design: "Payments"). */
@Component({
  selector: 'pp-payment-list',
  imports: [RouterLink, PageHeaderComponent, FilterTabsComponent, PaginationComponent, StatComponent, StatusPillComponent, InrPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './payment-list.component.html',
  styleUrl: './payment-list.component.scss',
})
export class PaymentListComponent {
  private paymentService = inject(PaymentService);
  private confirm = inject(ConfirmService);
  private alert = inject(AlertService);
  private auth = inject(AuthService);

  protected readonly tabs = TABS;
  protected readonly states = PAYMENT_STATES;
  protected readonly periods = periods();
  protected readonly whenLabel = whenLabel;
  protected canRefund = computed(() => this.auth.hasRole(...OWNER_ROLES));

  protected periodKey = signal(this.periods[0].key);
  protected tab = signal<PaymentTab>('all');
  protected page = signal(1);
  protected result = signal<Paged<Payment> | null>(null);
  protected summary = signal<PaymentSummary | null>(null);
  protected loading = signal(true);
  protected busyId = signal<string | null>(null);

  protected period = computed(() => this.periods.find(p => p.key === this.periodKey())!);
  protected stats = computed(() => {
    const s = this.summary();
    if (!s) return [];
    return [
      { label: 'Collected', value: formatInr(s.collectedPaise), sub: plural(s.collectedCount, 'payment') },
      { label: 'Waiting to be paid', value: formatInr(s.waitingPaise), sub: `${plural(s.waitingCount, 'link')} open now` },
      { label: 'Failed', value: s.failedCount, sub: s.failedCount ? 'Send a new link from the booking' : 'None this period' },
      { label: 'Refunded', value: formatInr(s.refundedPaise), sub: plural(s.refundedCount, 'refund') },
    ];
  });

  constructor() {
    effect(() => {
      const { from, to } = this.period();
      const tab = this.tab();
      const page = this.page();
      untracked(() => void this.load(tab, from, to, page));
    });
    effect(() => {
      const { from, to } = this.period();
      untracked(() => void this.loadSummary(from, to));
    });
  }

  setPeriod(e: Event): void {
    this.periodKey.set((e.target as HTMLSelectElement).value);
    this.page.set(1);
  }

  setTab(key: string): void {
    this.tab.set(key as PaymentTab);
    this.page.set(1);
  }

  /** Where the row's button goes: the booking, or the customer for plan payments. */
  protected target(p: Payment): string[] {
    return p.kind === 'booking' ? ['/bookings', p.reference] : ['/customers', p.customer.id];
  }

  protected actionLabel(p: Payment): string {
    if (p.kind === 'plan') return 'Customer';
    return { link_sent: 'Resend', expired: 'New link', failed: 'New link', paid: 'Booking', refunded: 'Booking' }[p.status];
  }

  async refund(p: Payment): Promise<void> {
    const ok = await this.confirm.ask({
      title: `Refund ${formatInr(p.amountPaise)} to ${p.customer.name}?`,
      message: `This marks ${p.id} (${p.reference}) as refunded. Until the payment gateway is connected, also send the money back from its dashboard. The booking itself doesn’t change; cancel it separately if needed.`,
      confirmLabel: 'Mark as refunded', cancelLabel: 'Keep it', tone: 'danger',
    });
    if (!ok) return;
    this.busyId.set(p.id);
    try {
      await this.paymentService.refund(p.id);
      this.alert.success(`${p.id} marked as refunded.`);
      const { from, to } = this.period();
      await Promise.all([this.load(this.tab(), from, to, this.page()), this.loadSummary(from, to)]);
    } finally {
      this.busyId.set(null);
    }
  }

  async exportCsv(): Promise<void> {
    const { from, to, label } = this.period();
    const all = await this.paymentService.list({ tab: this.tab(), from, to, page: 1, pageSize: 10_000 });
    downloadCsv(
      `payments-${label.toLowerCase().replace(/\s+/g, '-')}.csv`,
      ['Payment', 'For', 'Item', 'Customer', 'Amount', 'Status', 'Updated'],
      all.items.map(p => [p.id, p.reference, p.item, p.customer.name, formatInr(p.amountPaise), PAYMENT_STATES[p.status].label, p.at.slice(0, 16).replace('T', ' ')]),
    );
  }

  private async load(tab: PaymentTab, from: string, to: string, page: number): Promise<void> {
    this.loading.set(true);
    try {
      this.result.set(await this.paymentService.list({ tab, from, to, page, pageSize: PAGE_SIZE }));
    } finally {
      this.loading.set(false);
    }
  }

  private async loadSummary(from: string, to: string): Promise<void> {
    this.summary.set(await this.paymentService.summary(from, to));
  }
}
