import { Component, ChangeDetectionStrategy, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CATALOG_EDIT_ROLES } from '../../../core/constants/app.constants';
import { OFFER_STATUSES } from '../../../core/constants/status.constants';
import { Offer, OfferDraft, OfferScope } from '../../../core/models/offer.model';
import { AlertService } from '../../../core/services/alert.service';
import { AuthService } from '../../../core/services/auth.service';
import { CatalogService } from '../../../core/services/catalog.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import { OfferService } from '../../../core/services/offer.service';
import { shortDate, today } from '../../../core/utils/date.utils';
import { errorMessage } from '../../../core/utils/error.utils';
import { formatInr } from '../../../core/utils/money.utils';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { SegmentedComponent } from '../../../shared/components/segmented/segmented.component';
import { StatusPillComponent } from '../../../shared/components/status-pill/status-pill.component';
import { HasRoleDirective } from '../../../shared/directives/has-role.directive';

type DiscountType = Offer['discountType'];

const SCOPES: { value: OfferScope; label: string }[] = [
  { value: 'all_services', label: 'All services' },
  { value: 'some_services', label: 'Some services' },
  { value: 'plans', label: 'Membership plans' },
];

const DISCOUNT_TYPES = [
  { value: 'percent', label: '% off' },
  { value: 'flat', label: '₹ flat' },
];

/** Discounts and coupon codes (design: "Offers"). Customers redeem them at checkout once the backend is live. */
@Component({
  selector: 'pp-offers',
  imports: [ReactiveFormsModule, PageHeaderComponent, SegmentedComponent, StatusPillComponent, HasRoleDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './offers.component.html',
  styleUrl: './offers.component.scss',
})
export class OffersComponent {
  private offerService = inject(OfferService);
  private confirm = inject(ConfirmService);
  private alert = inject(AlertService);
  private auth = inject(AuthService);
  protected catalog = inject(CatalogService);

  protected readonly scopes = SCOPES;
  protected readonly discountTypes = DISCOUNT_TYPES;
  protected readonly statuses = OFFER_STATUSES;
  protected readonly editors = CATALOG_EDIT_ROLES;
  protected canEdit = computed(() => this.auth.hasRole(...CATALOG_EDIT_ROLES));

  protected offers = signal<Offer[]>([]);
  /** null = new offer. */
  protected selectedId = signal<string | null>(null);
  protected adding = signal(false);
  protected saving = signal(false);
  protected error = signal<string | null>(null);

  private editor = viewChild<ElementRef<HTMLElement>>('editor');

  protected form = inject(NonNullableFormBuilder).group({
    title: ['', Validators.required],
    discountType: ['percent' as DiscountType],
    /** Percent, or rupees for a flat discount. */
    value: [10, [Validators.required, Validators.min(1)]],
    code: ['', Validators.pattern(/^[A-Za-z0-9]{3,20}$/)],
    appliesTo: ['all_services' as OfferScope],
    serviceIds: [[] as string[]],
    startsOn: [today(), Validators.required],
    endsOn: [''],
    totalUses: [null as number | null, Validators.min(1)],
    perCustomer: [1 as number | null, Validators.min(1)],
    newCustomersOnly: [false],
  });

  /** Live copy of the form for the parts of the page that follow it. */
  protected value = signal(this.form.getRawValue());

  protected selected = computed(() => this.offers().find(o => o.id === this.selectedId()) ?? null);
  protected bookable = computed(() => this.catalog.services().filter(s => !s.archived));
  /** New offers and drafts can be kept as a draft; running ones are just saved. */
  protected canDraft = computed(() => this.adding() || !!this.selected()?.draft);
  protected primaryLabel = computed(() => {
    if (!this.canDraft()) return 'Save offer';
    return this.value().startsOn > today() ? 'Schedule offer' : 'Start offer';
  });

  constructor() {
    void this.catalog.load();
    void this.load();
    this.form.valueChanges.subscribe(() => this.value.set(this.form.getRawValue()));
  }

  protected valueLabel(o: Pick<Offer, 'discountType' | 'value'>): string {
    return o.discountType === 'percent' ? `${o.value}%` : formatInr(o.value);
  }

  protected scopeLabel(o: Offer): string {
    if (o.appliesTo === 'some_services') return `${o.serviceIds.length} service${o.serviceIds.length === 1 ? '' : 's'}`;
    return SCOPES.find(s => s.value === o.appliesTo)?.label ?? '';
  }

  protected datesLabel(o: Offer): string {
    if (o.status === 'expired') return `Ended ${shortDate(o.endsOn!)}`;
    if (o.startsOn > today()) return `Starts ${shortDate(o.startsOn)}`;
    return o.endsOn ? `Ends ${shortDate(o.endsOn)}` : 'No end date';
  }

  protected usesLabel(o: Offer): string {
    return o.totalUses === null ? `Used ${o.used}` : `Used ${o.used} of ${o.totalUses}`;
  }

  async select(o: Offer): Promise<void> {
    if (o.id === this.selectedId() || !(await this.okToLeave())) return;
    this.adding.set(false);
    this.selectedId.set(o.id);
    this.fill(o);
    this.revealEditor();
  }

  async add(): Promise<void> {
    if (!(await this.okToLeave())) return;
    this.adding.set(true);
    this.selectedId.set(null);
    this.fill(null);
    this.revealEditor();
  }

  setDiscountType(type: string): void {
    this.form.controls.discountType.setValue(type as DiscountType);
    this.form.markAsDirty();
  }

  toggleService(id: string): void {
    if (!this.canEdit()) return;
    const ids = this.form.controls.serviceIds.value;
    this.form.controls.serviceIds.setValue(ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]);
    this.form.markAsDirty();
  }

  /** Suggests a code from the title and the discount, e.g. DIWALI20. The server checks it's unique. */
  generateCode(): void {
    const v = this.form.getRawValue();
    const word = v.title.toUpperCase().replace(/[^A-Z0-9 ]/g, '').split(' ').find(w => w.length >= 3) ?? 'POSH';
    this.form.controls.code.setValue(`${word.slice(0, 14)}${Math.round(Number(v.value)) || ''}`);
    this.form.markAsDirty();
  }

  discard(): void {
    if (this.adding()) {
      this.adding.set(false);
      const first = this.offers()[0] ?? null;
      this.selectedId.set(first?.id ?? null);
      this.fill(first);
    } else {
      this.fill(this.selected());
    }
  }

  async save(asDraft: boolean): Promise<void> {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const draft: OfferDraft = {
      title: v.title, discountType: v.discountType, value: Math.round(Number(v.value)) * (v.discountType === 'flat' ? 100 : 1),
      code: v.code.trim().toUpperCase() || null, appliesTo: v.appliesTo, serviceIds: v.serviceIds, startsOn: v.startsOn, endsOn: v.endsOn || null,
      totalUses: v.totalUses, perCustomer: v.perCustomer, newCustomersOnly: v.newCustomersOnly, draft: asDraft,
    };
    this.saving.set(true);
    this.error.set(null);
    try {
      const saved = await this.offerService.save(draft, this.selectedId() ?? undefined);
      this.adding.set(false);
      this.selectedId.set(saved.id);
      await this.load();
      this.fill(saved);
      this.alert.success(asDraft ? 'Draft saved. Customers can’t use it yet.' : `${saved.title} saved. It’s ${OFFER_STATUSES[saved.status].label.toLowerCase()}.`);
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.saving.set(false);
    }
  }

  async setPaused(paused: boolean): Promise<void> {
    const o = this.selected();
    if (!o || !(await this.okToLeave())) return;
    if (paused) {
      const ok = await this.confirm.ask({
        title: `Pause ${o.title}?`,
        message: `Customers can’t use it until you resume it.${o.code ? ` The code ${o.code} stops working at checkout.` : ''}`,
        confirmLabel: 'Pause offer',
        cancelLabel: 'Keep it running',
      });
      if (!ok) return;
    }
    const saved = await this.offerService.setPaused(o.id, paused);
    await this.load();
    this.fill(saved);
    this.alert.success(paused ? `${o.title} paused.` : `${o.title} resumed. It’s ${OFFER_STATUSES[saved.status].label.toLowerCase()}.`);
  }

  private fill(o: Offer | null): void {
    this.form.reset({
      title: o?.title ?? '', discountType: o?.discountType ?? 'percent',
      value: o ? (o.discountType === 'flat' ? o.value / 100 : o.value) : 10,
      code: o?.code ?? '', appliesTo: o?.appliesTo ?? 'all_services', serviceIds: o?.serviceIds ?? [],
      startsOn: o?.startsOn ?? today(), endsOn: o?.endsOn ?? '', totalUses: o ? o.totalUses : null,
      perCustomer: o ? o.perCustomer : 1, newCustomersOnly: o?.newCustomersOnly ?? false,
    });
    this.error.set(null);
    if (!this.canEdit()) this.form.disable();
    this.value.set(this.form.getRawValue());
  }

  private async load(): Promise<void> {
    const offers = await this.offerService.list();
    this.offers.set(offers);
    if (!this.selectedId() && !this.adding() && offers.length) {
      this.selectedId.set(offers[0].id);
      this.fill(offers[0]);
    }
  }

  private async okToLeave(): Promise<boolean> {
    if (!this.form.dirty) return true;
    return this.confirm.ask({ title: 'Discard your changes?', message: 'You have unsaved changes to this offer.', confirmLabel: 'Discard', cancelLabel: 'Keep editing', tone: 'danger' });
  }

  private revealEditor(): void {
    if (window.innerWidth < 992) setTimeout(() => this.editor()?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }
}
