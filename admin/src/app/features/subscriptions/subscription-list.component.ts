import { Component, ChangeDetectionStrategy, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { catchError, finalize, of, switchMap, tap } from 'rxjs';
import { PLAN_CHANGE_ROLES } from '../../core/constants/app.constants';
import { Tone } from '../../core/constants/status.constants';
import { Paged } from '../../core/models/paged.model';
import { Subscription, SubscriptionSummary, SubscriptionTab } from '../../core/models/subscription.model';
import { SubscriptionService } from '../../core/services/subscription.service';
import { TemplateService } from '../../core/services/template.service';
import { formatPhone } from '../../core/utils/contact.utils';
import { downloadCsv } from '../../core/utils/csv.utils';
import { addDays, shortDate, today } from '../../core/utils/date.utils';
import { firstName } from '../../core/utils/message.utils';
import { formatInr } from '../../core/utils/money.utils';
import { FilterTab, FilterTabsComponent } from '../../shared/components/filter-tabs/filter-tabs.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { PaginationComponent } from '../../shared/components/pagination/pagination.component';
import { ShareDialogComponent } from '../../shared/components/share-dialog/share-dialog.component';
import { StatComponent } from '../../shared/components/stat/stat.component';
import { StatusPillComponent } from '../../shared/components/status-pill/status-pill.component';
import { HasRoleDirective } from '../../shared/directives/has-role.directive';
import { InrPipe } from '../../shared/pipes/inr.pipe';
import { ChangePlanComponent } from './change-plan/change-plan.component';

const PAGE_SIZE = 10;
const RENEWING_DAYS = 7;
const TABS: { key: SubscriptionTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'renewing', label: 'Renewing in 7 days' },
  { key: 'pending', label: 'Payment pending' },
  { key: 'ended', label: 'Expired or cancelled' },
];

interface Share { title: string; intro: string; phone: string; message: string }

/** Customers on a plan (design: "Subscriptions"). Plan prices and benefits live in Membership plans. */
@Component({
  selector: 'pp-subscription-list',
  imports: [
    RouterLink, PageHeaderComponent, StatComponent, FilterTabsComponent, PaginationComponent, StatusPillComponent, ShareDialogComponent,
    HasRoleDirective, InrPipe, ChangePlanComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './subscription-list.component.html',
  styleUrl: './subscription-list.component.scss',
})
export class SubscriptionListComponent {
  private subscriptionService = inject(SubscriptionService);
  private templates = inject(TemplateService);
  private router = inject(Router);

  protected readonly formatPhone = formatPhone;
  protected readonly shortDate = shortDate;
  protected readonly planChangers = PLAN_CHANGE_ROLES;

  protected tab = signal<SubscriptionTab>('all');
  protected page = signal(1);
  protected result = signal<Paged<Subscription> | null>(null);
  protected summary = signal<SubscriptionSummary | null>(null);
  protected loading = signal(true);
  protected busyId = signal<string | null>(null);
  protected share = signal<Share | null>(null);
  protected changing = signal<Subscription | null>(null);

  protected tabs = computed<FilterTab[]>(() => TABS.map(t => ({ ...t, count: this.summary()?.counts[t.key] ?? null })));

  protected stats = computed(() => {
    const s = this.summary();
    if (!s) return [];
    return [
      { label: 'Active', value: s.active, sub: s.byPlan.map(p => `${p.name} ${p.count}`).join(' · ') },
      { label: 'Monthly from plans', value: formatInr(s.monthlyPaise), sub: 'At current prices' },
      { label: 'Renewing in 7 days', value: s.renewingSoon, sub: `${s.needLink} need a renewal link` },
      { label: 'Ended this month', value: s.endedThisMonth, sub: `${s.expiredThisMonth} expired · ${s.cancelledThisMonth} cancelled` },
    ];
  });

  /** Bump to load the list again (after a link is sent). */
  private version = signal(0);
  private query = computed(() => ({ tab: this.tab(), page: this.page(), version: this.version() }));

  constructor() {
    this.loadSummary();
    this.templates.load().subscribe();
    // A newer tab or page cancels the older request (switchMap).
    toObservable(this.query).pipe(
      tap(() => this.loading.set(true)),
      switchMap(({ tab, page }) => this.subscriptionService.list(tab, page, PAGE_SIZE).pipe(catchError(() => of(null)))),
      takeUntilDestroyed(),
    ).subscribe(result => {
      if (result) this.result.set(result);
      this.loading.set(false);
    });
  }

  setTab(key: string): void {
    this.tab.set(key as SubscriptionTab);
    this.page.set(1);
  }

  protected renewing(s: Subscription): boolean {
    return s.status === 'active' && !!s.renewsOn && s.renewsOn <= addDays(today(), RENEWING_DAYS);
  }

  protected status(s: Subscription): { label: string; tone: Tone } {
    if (s.status === 'payment_pending') return { label: 'Payment pending', tone: 'warn' };
    if (s.status === 'expired') return { label: 'Expired', tone: 'neutral' };
    if (s.status === 'cancelled') return { label: 'Cancelled', tone: 'danger' };
    return this.renewing(s) ? { label: 'Renews soon', tone: 'warn' } : { label: 'Active', tone: 'success' };
  }

  protected period(s: Subscription): string {
    if (s.status === 'payment_pending') return 'Waiting for payment';
    if (s.endedOn) return `${s.status === 'cancelled' ? 'Cancelled' : 'Ended'} ${shortDate(s.endedOn)}`;
    return s.renewsOn ? `Renews ${shortDate(s.renewsOn)}` : '—';
  }

  protected usage(s: Subscription): { text: string; width: string } {
    if (s.sessionsTotal === null) return { text: `${s.sessionsUsed} used · unlimited`, width: '30%' };
    return { text: `${s.sessionsUsed} of ${s.sessionsTotal}`, width: `${(s.sessionsUsed / s.sessionsTotal) * 100}%` };
  }

  /** Each row's next step. */
  protected action(s: Subscription): { label: string; kind: 'link' | 'winback' | 'view'; primary: boolean } {
    if (s.status === 'payment_pending') return { label: 'Resend link', kind: 'link', primary: true };
    if (this.renewing(s)) return { label: s.paymentLink ? 'Resend renewal link' : 'Send renewal link', kind: 'link', primary: !s.paymentLink };
    if (s.status === 'expired') return { label: 'Win back', kind: 'winback', primary: true };
    return { label: 'View', kind: 'view', primary: false };
  }

  run(s: Subscription): void {
    const a = this.action(s);
    if (a.kind === 'view') {
      void this.router.navigate(['/customers', s.customer.id]);
      return;
    }
    if (a.kind === 'winback') {
      this.share.set({
        title: 'Win back', intro: `${s.customer.name}'s ${s.planName} plan has ended.`, phone: s.customer.phone,
        message: this.templates.render('win_back', { customer_name: firstName(s.customer.name), plan: s.planName }),
      });
      return;
    }
    this.busyId.set(s.id);
    this.subscriptionService.sendPaymentLink(s.id).pipe(finalize(() => this.busyId.set(null))).subscribe(updated => {
      this.share.set({
        title: updated.status === 'payment_pending' ? 'Payment link' : 'Renewal link',
        intro: `Link created for ${updated.customer.name}. Send it on WhatsApp:`,
        phone: updated.customer.phone,
        message: this.templates.render(updated.status === 'payment_pending' ? 'plan_payment' : 'plan_renewal', {
          customer_name: firstName(updated.customer.name), plan: updated.paymentLink!.planName, amount: formatInr(updated.paymentLink!.amountPaise),
          renewal_date: updated.renewsOn ? shortDate(updated.renewsOn) : '', payment_link: updated.paymentLink!.link,
        }),
      });
      this.version.update(v => v + 1);
      this.loadSummary();
    });
  }

  /** Only plans still running can change. */
  protected canChange(s: Subscription): boolean {
    return s.status === 'active' || s.status === 'payment_pending';
  }

  onPlanChanged(): void {
    this.changing.set(null);
    this.version.update(v => v + 1);
    this.loadSummary();
  }

  exportCsv(): void {
    this.subscriptionService.list(this.tab(), 1, 10_000).subscribe(all => downloadCsv(
      'subscriptions.csv',
      ['Customer', 'Phone', 'Plan', 'Price', 'Started', 'Renews / ended', 'Sessions', 'Status'],
      all.items.map(s => [s.customer.name, formatPhone(s.customer.phone), s.planName, formatInr(s.pricePaise), s.startedOn, this.period(s), this.usage(s).text, this.status(s).label]),
    ));
  }

  private loadSummary(): void {
    this.subscriptionService.summary().subscribe(s => this.summary.set(s));
  }
}
