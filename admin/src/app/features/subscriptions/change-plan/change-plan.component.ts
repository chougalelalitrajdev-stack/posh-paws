import { Component, ChangeDetectionStrategy, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { PAYMENT_METHODS } from '../../../core/constants/status.constants';
import { PlanChangeRequest, PlanOption, Subscription } from '../../../core/models/subscription.model';
import { AlertService } from '../../../core/services/alert.service';
import { SettingsService } from '../../../core/services/settings.service';
import { SubscriptionService } from '../../../core/services/subscription.service';
import { shortDate } from '../../../core/utils/date.utils';
import { errorMessage } from '../../../core/utils/error.utils';
import { firstName } from '../../../core/utils/message.utils';
import { formatInr } from '../../../core/utils/money.utils';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { InrPipe } from '../../../shared/pipes/inr.pipe';

type ShopMethod = NonNullable<PlanChangeRequest['method']>;
const METHODS: ShopMethod[] = ['upi_qr', 'cash', 'card'];

/** Move a member to another plan: an upgrade starts now (they pay the difference), a downgrade at the next renewal. */
@Component({
  selector: 'pp-change-plan',
  imports: [ReactiveFormsModule, ModalComponent, InrPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './change-plan.component.html',
  styleUrl: './change-plan.component.scss',
})
export class ChangePlanComponent implements OnInit {
  private subscriptionService = inject(SubscriptionService);
  private alert = inject(AlertService);
  protected settings = inject(SettingsService);

  readonly subscriptionId = input.required<string>();
  readonly customerName = input.required<string>();
  /** A downgrade already waiting for renewal, if any. */
  readonly nextPlanName = input<string | null>(null);
  readonly closed = output<void>();
  readonly saved = output<Subscription>();

  protected readonly methods = METHODS.map(value => ({ value, label: PAYMENT_METHODS[value] }));
  protected form = inject(NonNullableFormBuilder).group({ planId: [''], method: ['upi_qr' as ShopMethod] });
  protected options = signal<PlanOption[] | null>(null);
  protected saving = signal(false);
  protected error = signal<string | null>(null);

  private planId = toSignal(this.form.controls.planId.valueChanges, { initialValue: '' });
  protected selected = computed(() => this.options()?.find(o => o.planId === this.planId()) ?? null);
  protected title = computed(() => `Change ${firstName(this.customerName())}’s plan`);

  protected submitLabel = computed(() => {
    const o = this.selected();
    switch (o?.change) {
      case 'upgrade': return `Upgrade to ${o.name}`;
      case 'downgrade': return `Move to ${o.name} at renewal`;
      case 'switch': return `Change to ${o.name}`;
      case 'current': return `Stay on ${o.name}`;
      default: return 'Change plan';
    }
  });

  ngOnInit(): void {
    this.settings.load().subscribe();
    this.subscriptionService.planOptions(this.subscriptionId()).subscribe({
      next: options => this.options.set(options),
      error: e => this.error.set(errorMessage(e)),
    });
  }

  /** The current plan can only be picked to call off a waiting downgrade. */
  protected disabled(o: PlanOption): boolean {
    return o.change === 'current' && !this.nextPlanName();
  }

  protected note(o: PlanOption): string {
    const sessions = o.sessionsLeft === null ? 'unlimited sessions' : `${o.sessionsLeft} session${o.sessionsLeft === 1 ? '' : 's'} left this month`;
    const discount = o.discountPercent ? ` · ${o.discountPercent}% off other services` : '';
    switch (o.change) {
      case 'current': return this.nextPlanName() ? `Current plan. Pick it to stay and call off the move to ${this.nextPlanName()}.` : `Current plan · ${sessions}`;
      case 'upgrade': return `Starts today · ${formatInr(o.payNowPaise)} to pay now · ${sessions}${discount}. Renewal date stays.`;
      case 'downgrade': return `Starts at renewal on ${shortDate(o.startsOn)} · ${formatInr(o.pricePaise)} a month from then. Nothing changes until then.`;
      case 'switch': return `Changes now, as the first month isn’t paid yet · ${o.sessionsPerPeriod === null ? 'unlimited sessions' : `${o.sessionsPerPeriod} sessions`}${discount}`;
      default: return '';
    }
  }

  save(): void {
    const o = this.selected();
    if (!o || this.saving()) return;
    this.saving.set(true);
    this.error.set(null);
    const request: PlanChangeRequest = { planId: o.planId, ...(o.change === 'upgrade' && { method: this.form.controls.method.value }) };
    this.subscriptionService.changePlan(this.subscriptionId(), request)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: s => {
          this.alert.success(this.doneMessage(s));
          this.saved.emit(s);
        },
        error: e => this.error.set(errorMessage(e)),
      });
  }

  private doneMessage(s: Subscription): string {
    const c = s.changes[0];
    const name = firstName(s.customer.name);
    switch (c.kind) {
      case 'upgrade': return `${name} is on ${c.toPlan} now. ${formatInr(c.paidPaise)} difference recorded.`;
      case 'downgrade': return `${name} moves to ${c.toPlan} on ${shortDate(s.renewsOn!)}.`;
      case 'keep': return `${name} stays on ${c.fromPlan}.`;
      case 'switch': return `${name} is on ${c.toPlan} now. Send a new payment link for the first month.`;
    }
  }
}
