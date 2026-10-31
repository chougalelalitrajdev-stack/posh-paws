import { Component, ChangeDetectionStrategy, computed, inject, signal } from '@angular/core';
import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { FormArray, FormControl, FormGroup, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CATALOG_EDIT_ROLES } from '../../../core/constants/app.constants';
import { Billing, Plan, PlanDraft } from '../../../core/models/plan.model';
import { AlertService } from '../../../core/services/alert.service';
import { AuthService } from '../../../core/services/auth.service';
import { CatalogService } from '../../../core/services/catalog.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import { PlanService } from '../../../core/services/plan.service';
import { errorMessage } from '../../../core/utils/error.utils';
import { formatInr } from '../../../core/utils/money.utils';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { StatusPillComponent } from '../../../shared/components/status-pill/status-pill.component';
import { SwitchComponent } from '../../../shared/components/switch/switch.component';
import { HasRoleDirective } from '../../../shared/directives/has-role.directive';
import { InrPipe } from '../../../shared/pipes/inr.pipe';

const BILLING: { value: Billing; label: string; per: string }[] = [
  { value: 'month', label: 'Every month', per: 'month' },
  { value: 'quarter', label: 'Every 3 months', per: '3 months' },
  { value: 'year', label: 'Every year', per: 'year' },
];

type BenefitGroup = FormGroup<{ text: FormControl<string>; included: FormControl<boolean> }>;

/** What each membership plan costs and includes (design: "Membership plans"). */
@Component({
  selector: 'pp-plans',
  imports: [ReactiveFormsModule, RouterLink, CdkDropList, CdkDrag, CdkDragHandle, PageHeaderComponent, StatusPillComponent, SwitchComponent, HasRoleDirective, InrPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './plans.component.html',
  styleUrl: './plans.component.scss',
})
export class PlansComponent {
  private planService = inject(PlanService);
  private confirm = inject(ConfirmService);
  private alert = inject(AlertService);
  private auth = inject(AuthService);
  private fb = inject(NonNullableFormBuilder);
  protected catalog = inject(CatalogService);

  protected readonly billing = BILLING;
  protected readonly editors = CATALOG_EDIT_ROLES;
  protected canEdit = computed(() => this.auth.hasRole(...CATALOG_EDIT_ROLES));

  protected plans = signal<Plan[]>([]);
  /** null = new plan. */
  protected selectedId = signal<string | null>(null);
  protected adding = signal(false);
  protected saving = signal(false);
  protected error = signal<string | null>(null);

  protected form = this.fb.group({
    name: ['', Validators.required],
    tagline: [''],
    priceRupees: [0, [Validators.required, Validators.min(1)]],
    billing: ['month' as Billing],
    unlimited: [false],
    sessions: [2, Validators.min(1)],
    discountPercent: [0, [Validators.min(0), Validators.max(90)]],
    eligibleServiceIds: [[] as string[]],
    benefits: this.fb.array<BenefitGroup>([]),
    featured: [false],
    subscribable: [true],
  });

  /** Live copy of the form for the preview card and the service chips. */
  protected value = signal(this.form.getRawValue());

  protected selected = computed(() => this.plans().find(p => p.id === this.selectedId()) ?? null);
  protected bookable = computed(() => this.catalog.services().filter(s => !s.archived));
  protected per = computed(() => BILLING.find(b => b.value === this.value().billing)?.per ?? 'month');

  constructor() {
    void this.catalog.load();
    void this.load();
    this.form.valueChanges.subscribe(() => this.value.set(this.form.getRawValue()));
    this.form.controls.unlimited.valueChanges.subscribe(() => this.syncSessions());
  }

  get benefits(): FormArray<BenefitGroup> {
    return this.form.controls.benefits;
  }

  protected priceLabel(p: Plan): string {
    const per = BILLING.find(b => b.value === p.billing)?.per ?? 'month';
    return `${formatInr(p.pricePaise)} a ${per} · ${p.sessionsPerPeriod ?? 'Unlimited'} sessions`;
  }

  async select(p: Plan): Promise<void> {
    if (p.id === this.selectedId() || !(await this.okToLeave())) return;
    this.adding.set(false);
    this.selectedId.set(p.id);
    this.fill(p);
  }

  async add(): Promise<void> {
    if (!(await this.okToLeave())) return;
    this.adding.set(true);
    this.selectedId.set(null);
    this.fill(null);
  }

  toggleService(id: string): void {
    if (!this.canEdit()) return;
    const ids = this.form.controls.eligibleServiceIds.value;
    this.form.controls.eligibleServiceIds.setValue(ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]);
    this.form.markAsDirty();
  }

  addBenefit(): void {
    this.benefits.push(this.benefitGroup('', true));
    this.form.markAsDirty();
    setTimeout(() => document.getElementById(`benefit-${this.benefits.length - 1}`)?.focus());
  }

  removeBenefit(i: number): void {
    this.benefits.removeAt(i);
    this.form.markAsDirty();
  }

  dropBenefit(e: CdkDragDrop<unknown>): void {
    this.moveBenefit(e.previousIndex, e.currentIndex);
  }

  /** Keyboard alternative to dragging. */
  moveWithKeys(e: KeyboardEvent, i: number): void {
    const to = e.key === 'ArrowUp' ? i - 1 : e.key === 'ArrowDown' ? i + 1 : -1;
    if (to < 0 || to >= this.benefits.length) return;
    e.preventDefault();
    this.moveBenefit(i, to);
    setTimeout(() => document.getElementById(`benefit-handle-${to}`)?.focus());
  }

  discard(): void {
    if (this.adding()) {
      this.adding.set(false);
      const first = this.plans()[0];
      this.selectedId.set(first?.id ?? null);
      this.fill(first ?? null);
    } else {
      this.fill(this.selected());
    }
  }

  async save(): Promise<void> {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const draft: PlanDraft = {
      name: v.name, tagline: v.tagline, pricePaise: Math.round(Number(v.priceRupees)) * 100, billing: v.billing,
      sessionsPerPeriod: v.unlimited ? null : Number(v.sessions), discountPercent: Number(v.discountPercent),
      eligibleServiceIds: v.eligibleServiceIds, benefits: v.benefits, featured: v.featured, subscribable: v.subscribable,
    };
    const current = this.selected();
    if (current && current.activeSubscribers && draft.pricePaise !== current.pricePaise) {
      const ok = await this.confirm.ask({
        title: 'Change the price?',
        message: `New subscribers pay ${formatInr(draft.pricePaise)} from now. The ${current.activeSubscribers} current members keep ${formatInr(current.pricePaise)} until their next renewal.`,
        confirmLabel: 'Save new price',
      });
      if (!ok) return;
    }
    this.saving.set(true);
    this.error.set(null);
    try {
      const saved = await this.planService.save(draft, current?.id);
      await this.load();
      this.adding.set(false);
      this.selectedId.set(saved.id);
      this.fill(this.selected());
      this.alert.success(`${saved.name} plan saved.`);
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.saving.set(false);
    }
  }

  private moveBenefit(from: number, to: number): void {
    if (from === to) return;
    const items = [...this.benefits.controls];
    moveItemInArray(items, from, to);
    this.benefits.clear({ emitEvent: false });
    items.forEach(c => this.benefits.push(c, { emitEvent: false }));
    this.benefits.updateValueAndValidity();
    this.form.markAsDirty();
  }

  private benefitGroup(text: string, included: boolean): BenefitGroup {
    return this.fb.group({ text: [text], included: [included] });
  }

  private fill(p: Plan | null): void {
    this.benefits.clear({ emitEvent: false });
    (p?.benefits ?? []).forEach(b => this.benefits.push(this.benefitGroup(b.text, b.included), { emitEvent: false }));
    this.form.reset({
      name: p?.name ?? '', tagline: p?.tagline ?? '', priceRupees: (p?.pricePaise ?? 0) / 100, billing: p?.billing ?? 'month',
      unlimited: p ? p.sessionsPerPeriod === null : false, sessions: p?.sessionsPerPeriod ?? 2, discountPercent: p?.discountPercent ?? 0,
      eligibleServiceIds: p?.eligibleServiceIds ?? [], featured: p?.featured ?? false, subscribable: p?.subscribable ?? true,
    });
    this.error.set(null);
    if (!this.canEdit()) this.form.disable();
    this.syncSessions();
    this.value.set(this.form.getRawValue());
  }

  /** The sessions box is off while "Unlimited" is ticked. */
  private syncSessions(): void {
    const sessions = this.form.controls.sessions;
    if (this.form.controls.unlimited.value || !this.canEdit()) sessions.disable({ emitEvent: false });
    else sessions.enable({ emitEvent: false });
  }

  private async load(): Promise<void> {
    const plans = await this.planService.list();
    this.plans.set(plans);
    if (!this.selectedId() && !this.adding() && plans.length) {
      const pick = plans.find(p => p.featured) ?? plans[0];
      this.selectedId.set(pick.id);
      this.fill(pick);
    }
  }

  private async okToLeave(): Promise<boolean> {
    if (!this.form.dirty) return true;
    return this.confirm.ask({ title: 'Discard your changes?', message: 'You have unsaved changes to this plan.', confirmLabel: 'Discard', cancelLabel: 'Keep editing', tone: 'danger' });
  }
}
