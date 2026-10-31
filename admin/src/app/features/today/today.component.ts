import { Component, ChangeDetectionStrategy, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Tone } from '../../core/constants/status.constants';
import { Booking } from '../../core/models/booking.model';
import { AttentionItem, DashboardSummary } from '../../core/models/dashboard.model';
import { AuthService } from '../../core/services/auth.service';
import { CatalogService } from '../../core/services/catalog.service';
import { DashboardService } from '../../core/services/dashboard.service';
import { ageLabel, greeting, longDate, today, weekday } from '../../core/utils/date.utils';
import { formatInr } from '../../core/utils/money.utils';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { StatusPillComponent } from '../../shared/components/status-pill/status-pill.component';
import { InrPipe } from '../../shared/pipes/inr.pipe';

const ATTENTION_TAGS: Record<AttentionItem['kind'], { label: string; tone: Tone }> = {
  request: { label: 'Request', tone: 'info' },
  failed: { label: 'Failed', tone: 'danger' },
  unpaid: { label: 'Unpaid', tone: 'warn' },
  draft: { label: 'Draft', tone: 'draft' },
  content: { label: 'Content', tone: 'neutral' },
};

/** Today: what needs attention now, the day's schedule and the week at a glance (design: "Shell + Today dashboard"). */
@Component({
  selector: 'pp-today',
  imports: [RouterLink, PageHeaderComponent, StatusPillComponent, InrPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './today.component.html',
  styleUrl: './today.component.scss',
})
export class TodayComponent {
  private dashboard = inject(DashboardService);
  private auth = inject(AuthService);
  protected catalog = inject(CatalogService);

  protected data = signal<DashboardSummary | null>(null);
  protected readonly attentionTags = ATTENTION_TAGS;

  protected title = computed(() => `${greeting()}, ${(this.auth.user()?.name ?? '').split(/\s+/)[0]}`);
  protected subtitle = computed(() => {
    const d = this.data();
    if (!d) return longDate(today());
    return `${longDate(today())} · ${d.today.count} appointment${d.today.count === 1 ? '' : 's'} today · ${d.openStations} stations open`;
  });

  protected kpis = computed(() => {
    const d = this.data();
    if (!d) return [];
    return [
      {
        label: 'New callback requests', value: d.requests.count, tone: 'info' as Tone, link: '/requests', action: 'Call back',
        sub: d.requests.oldestAt ? `Oldest waiting ${ageLabel(d.requests.oldestAt)}` : 'Nobody waiting',
      },
      {
        label: 'Awaiting payment', value: d.awaitingPayment.count, tone: 'warn' as Tone, link: '/bookings', query: { stage: 'awaiting_payment' }, action: 'Follow up',
        sub: `${formatInr(d.awaitingPayment.outstandingPaise)} outstanding · ${d.awaitingPayment.failed} failed`,
      },
      {
        label: "Today's appointments", value: d.today.count, tone: 'success' as Tone, link: '/bookings', query: { view: 'calendar' }, action: 'Open calendar',
        sub: `${d.today.done} done · ${d.today.nextTime ? `next at ${d.today.nextTime}` : 'none left today'}`,
      },
      {
        label: 'Renewals this week', value: d.renewalsThisWeek, tone: 'draft' as Tone, link: '/subscriptions', action: 'View subscribers',
        sub: 'Memberships ending by Sunday',
      },
    ];
  });

  /** Payments bars, scaled to the best day. */
  protected bars = computed(() => {
    const days = this.data()?.payments.days ?? [];
    const max = Math.max(...days.map(d => d.amountPaise), 1);
    return days.map(d => ({
      label: weekday(d.date),
      amount: formatInr(d.amountPaise),
      height: `${Math.max((d.amountPaise / max) * 100, 2)}%`,
      isToday: d.date === today(),
    }));
  });

  protected barsLabel = computed(() => `Payments per day: ${this.bars().map(b => `${b.label} ${b.amount}`).join(', ')}`);

  protected planBars = computed(() => {
    const plans = this.data()?.memberships.plans ?? [];
    const max = Math.max(...plans.map(p => p.count), 1);
    return plans.map(p => ({ ...p, width: `${(p.count / max) * 100}%` }));
  });

  constructor() {
    void this.catalog.load();
    void this.load();
  }

  protected scheduleStatus(b: Booking): { label: string; tone: Tone } {
    if (b.stage === 'completed') return { label: 'Done', tone: 'neutral' };
    if (b.stage === 'awaiting_payment') return { label: 'Unpaid', tone: 'warn' };
    return { label: 'Confirmed', tone: 'success' };
  }

  private async load(): Promise<void> {
    this.data.set(await this.dashboard.summary());
  }
}
