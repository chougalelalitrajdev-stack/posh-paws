import { Component, ChangeDetectionStrategy, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { BOOKING_RULES_NOTE, PAYMENT_LINK_HOURS, SLOT_HOLD_PAISE } from '../../../core/constants/app.constants';
import { CALL_OUTCOMES, SOURCES } from '../../../core/constants/status.constants';
import { AmountType, Booking, BookingDetails, CallOutcome } from '../../../core/models/booking.model';
import { DayAvailability } from '../../../core/models/calendar.model';
import { PetType, Service } from '../../../core/models/catalog.model';
import { Customer, CustomerPet, CustomerPlan } from '../../../core/models/customer.model';
import { AlertService } from '../../../core/services/alert.service';
import { BookingService } from '../../../core/services/booking.service';
import { CatalogService } from '../../../core/services/catalog.service';
import { CustomerService } from '../../../core/services/customer.service';
import { PetService } from '../../../core/services/pet.service';
import { formatPhone, telLink, whatsappLink } from '../../../core/utils/contact.utils';
import { formatDuration, monthYear, shortDate, today, whenLabel } from '../../../core/utils/date.utils';
import { errorMessage } from '../../../core/utils/error.utils';
import { discounted } from '../../../core/utils/money.utils';
import { paymentLinkMessage } from '../../../core/utils/message.utils';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { SegmentedComponent } from '../../../shared/components/segmented/segmented.component';
import { SlotPickerComponent } from '../../../shared/components/slot-picker/slot-picker.component';
import { StatusPillComponent } from '../../../shared/components/status-pill/status-pill.component';
import { DurationPipe } from '../../../shared/pipes/duration.pipe';
import { InrPipe } from '../../../shared/pipes/inr.pipe';
import { BookingStepComponent } from './booking-step/booking-step.component';

type Step = 1 | 2 | 3 | 4;

/**
 * Callback → booking → payment link (design: "New booking").
 * Opened from a request or draft with ?from=PP-1051, or blank from "+ New booking".
 */
@Component({
  selector: 'pp-new-booking',
  imports: [
    RouterLink, ReactiveFormsModule, PageHeaderComponent, StatusPillComponent, SegmentedComponent,
    SlotPickerComponent, BookingStepComponent, IconComponent, InrPipe, DurationPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './new-booking.component.html',
  styleUrl: './new-booking.component.scss',
})
export class NewBookingComponent {
  private bookingService = inject(BookingService);
  private customerService = inject(CustomerService);
  private petService = inject(PetService);
  private alert = inject(AlertService);
  private fb = inject(NonNullableFormBuilder);
  protected catalog = inject(CatalogService);

  /** Query params: the request or draft to continue, or a customer (and pet) to start with. */
  readonly from = input<string>();
  readonly customerId = input<string>(undefined, { alias: 'customer' });
  readonly petIdParam = input<string>(undefined, { alias: 'pet' });

  protected readonly callOutcomes = CALL_OUTCOMES;
  protected readonly sources = SOURCES;
  protected readonly holdPaise = SLOT_HOLD_PAISE;
  protected readonly linkHours = PAYMENT_LINK_HOURS;
  protected readonly rulesNote = BOOKING_RULES_NOTE;
  protected readonly formatPhone = formatPhone;
  protected readonly telLink = telLink;
  protected readonly whenLabel = whenLabel;

  protected step = signal<Step>(1);
  protected source = signal<Booking | null>(null);
  protected loadingSource = signal(false);

  // Step 1: customer and pet
  protected customer = signal<Customer | null>(null);
  protected customerIsNew = signal(false);
  protected phone = this.fb.control('', [Validators.required, Validators.pattern(/^\D*(\d\D*){10}$/)]);
  protected newName = this.fb.control('', Validators.required);
  protected lookup = signal<'idle' | 'searching' | 'not-found'>('idle');
  protected petId = signal<string | null>(null);
  protected addingPet = signal(false);
  protected petForm = this.fb.group({ name: ['', Validators.required], type: ['dog' as PetType], breed: [''] });

  // Steps 2–4
  protected serviceId = signal<string | null>(null);
  protected days = signal<DayAvailability[]>([]);
  protected daysLoading = signal(false);
  protected date = signal<string | null>(null);
  protected time = signal<string | null>(null);
  protected amountType = signal<AmountType>('full');

  protected busy = signal(false);
  protected error = signal<string | null>(null);
  /** The booking once its payment link exists. */
  protected done = signal<Booking | null>(null);

  protected pet = computed<CustomerPet | null>(() => this.customer()?.pets.find(p => p.id === this.petId()) ?? null);
  protected services = computed(() => {
    const pet = this.pet();
    return pet ? this.catalog.servicesFor(pet.type) : [];
  });
  protected service = computed<Service | null>(() => this.catalog.services().find(s => s.id === this.serviceId()) ?? null);
  protected plan = computed<CustomerPlan | null>(() => this.customer()?.plan ?? null);
  protected discount = computed(() => this.plan()?.discountPercent ?? 0);
  protected price = computed(() => {
    const s = this.service();
    return s ? discounted(s.pricePaise, this.discount()) : null;
  });
  protected amount = computed(() => {
    const price = this.price();
    if (price === null) return null;
    return this.amountType() === 'hold' ? Math.min(SLOT_HOLD_PAISE, price) : price;
  });
  protected when = computed(() => {
    const d = this.date();
    const t = this.time();
    return d && t ? `${shortDate(d)} · ${t}` : '';
  });
  protected message = computed(() =>
    paymentLinkMessage({
      customerName: this.customer()?.name ?? '',
      petName: this.pet()?.name ?? 'Your pet',
      serviceName: this.service()?.name ?? '[service]',
      when: this.when(),
      amountPaise: this.amount() ?? 0,
      link: this.done()?.payment?.link,
    }),
  );
  protected whatsappHref = computed(() => {
    const c = this.customer();
    return c ? whatsappLink(c.phone, this.message()) : '';
  });

  protected title = computed(() => (this.pet() ? `Book ${this.pet()!.name} in` : 'New booking'));
  protected requested = computed(() => this.source()?.request?.interestedIn ?? null);
  protected customerLine = computed(() => {
    const c = this.customer();
    if (!c) return '';
    const plan = c.plan
      ? `${c.plan.name} plan, ${c.plan.sessionsLeft === null ? 'unlimited sessions' : `${c.plan.sessionsLeft} of ${c.plan.sessionsTotal} sessions left`}`
      : 'no membership';
    return `customer since ${monthYear(c.customerSince)} · ${plan}`;
  });
  protected canSaveDraft = computed(() => !!this.customer() && !!this.pet() && !!this.service() && !this.done());

  constructor() {
    void this.catalog.load();

    effect(() => {
      const id = this.from();
      const customerId = this.customerId();
      const petId = this.petIdParam();
      untracked(() => {
        if (id) void this.loadSource(id);
        else if (customerId) void this.loadCustomer(customerId, petId);
        else this.reset();
      });
    });

    effect(() => {
      const service = this.service();
      if (service && this.step() === 3) untracked(() => void this.loadSlots(service.id));
    });
  }

  protected stepState(n: Step): 'open' | 'done' | 'later' {
    if (this.done()) return 'done';
    return n === this.step() ? 'open' : n < this.step() ? 'done' : 'later';
  }

  protected petLine(p: CustomerPet): string {
    return [p.breed ?? (p.type === 'dog' ? 'Dog' : 'Cat'), p.gender].filter(Boolean).join(' · ');
  }

  protected memberPrice(s: Service): number {
    return discounted(s.pricePaise, this.discount());
  }

  goTo(n: Step): void {
    if (this.done()) return;
    this.error.set(null);
    this.step.set(n);
  }

  // ── Step 1 ──
  async findCustomer(): Promise<void> {
    if (this.phone.invalid) {
      this.phone.markAsTouched();
      return;
    }
    this.lookup.set('searching');
    this.error.set(null);
    const found = await this.customerService.findByPhone(this.phone.value).catch(() => null);
    if (found) {
      this.setCustomer(found, false);
      this.lookup.set('idle');
    } else {
      this.lookup.set('not-found');
    }
  }

  async createCustomer(): Promise<void> {
    if (this.newName.invalid) {
      this.newName.markAsTouched();
      return;
    }
    await this.run(async () => {
      const c = await this.customerService.create({ name: this.newName.value.trim(), phone: this.phone.value });
      this.setCustomer(c, true);
      this.lookup.set('idle');
    });
  }

  changeCustomer(): void {
    this.customer.set(null);
    this.petId.set(null);
    this.serviceId.set(null);
    this.lookup.set('idle');
  }

  async addPet(): Promise<void> {
    const c = this.customer();
    if (!c || this.petForm.invalid) {
      this.petForm.markAllAsTouched();
      return;
    }
    await this.run(async () => {
      const { name, type, breed } = this.petForm.getRawValue();
      const pet = await this.petService.add(c.id, { name: name.trim(), type, ...(breed.trim() && { breed: breed.trim() }) });
      this.customer.set({ ...c, pets: [...c.pets, pet] });
      this.petId.set(pet.id);
      this.addingPet.set(false);
      this.petForm.reset({ name: '', type: 'dog', breed: '' });
    });
  }

  continueFromPet(): void {
    const pet = this.pet();
    if (!pet) return;
    if (this.service()?.petType !== pet.type) this.serviceId.set(this.matchRequestedService(pet.type));
    this.goTo(2);
  }

  // ── Steps 2–4 ──
  continueFromService(): void {
    if (this.service()) this.goTo(3);
  }

  continueFromSlot(): void {
    if (this.date() && this.time()) this.goTo(4);
  }

  /** Saves the details, creates the payment link, then shows the "send it" panel. */
  async createLink(copy: boolean): Promise<void> {
    await this.run(async () => {
      const saved = await this.bookingService.saveDetails(this.details(), this.source()?.id);
      this.source.set(saved);
      const booking = await this.bookingService.sendPaymentLink(saved.id, this.amountType());
      this.done.set(booking);
      if (copy) await this.copy(booking.payment!.link, 'Payment link copied.');
    });
  }

  async saveDraft(): Promise<void> {
    if (!this.canSaveDraft()) return;
    await this.run(async () => {
      const saved = await this.bookingService.saveDetails(this.details(), this.source()?.id);
      this.source.set(saved);
      this.alert.success(`Draft saved as ${saved.id}.`);
    });
  }

  async setOutcome(outcome: string): Promise<void> {
    const b = this.source();
    if (!b) return;
    this.source.set(await this.bookingService.setCallOutcome(b.id, outcome as CallOutcome));
  }

  async copy(text: string, success: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      this.alert.success(success);
    } catch {
      this.alert.error('Could not copy. Select the text and copy it instead.');
    }
  }

  private details(): BookingDetails {
    return { customerId: this.customer()!.id, petId: this.petId()!, serviceId: this.serviceId()!, date: this.date(), time: this.time() };
  }

  private setCustomer(c: Customer, isNew: boolean): void {
    this.customer.set(c);
    this.customerIsNew.set(isNew);
    if (!c.pets.some(p => p.id === this.petId())) this.petId.set(c.pets.length === 1 ? c.pets[0].id : null);
    this.addingPet.set(c.pets.length === 0);
  }

  /** Preselect the service the customer asked for in the request, if it fits the pet. */
  private matchRequestedService(type: PetType): string | null {
    const wanted = this.requested()?.toLowerCase();
    return this.catalog.servicesFor(type).find(s => s.name.toLowerCase() === wanted)?.id ?? null;
  }

  private async loadSource(id: string): Promise<void> {
    this.reset();
    this.loadingSource.set(true);
    try {
      await this.catalog.load();
      const b = await this.bookingService.get(id);
      this.source.set(b);
      this.setCustomer(await this.customerService.get(b.customer.id), false);
      if (b.pet) this.petId.set(b.pet.id);
      this.serviceId.set(b.service?.id ?? (this.pet() ? this.matchRequestedService(this.pet()!.type) : null));
      this.date.set(b.date);
      this.time.set(b.time);
    } finally {
      this.loadingSource.set(false);
    }
  }

  private async loadCustomer(customerId: string, petId?: string): Promise<void> {
    this.reset();
    this.loadingSource.set(true);
    try {
      await this.catalog.load();
      this.setCustomer(await this.customerService.get(customerId), false);
      if (petId && this.customer()?.pets.some(p => p.id === petId)) this.petId.set(petId);
    } finally {
      this.loadingSource.set(false);
    }
  }

  private async loadSlots(serviceId: string): Promise<void> {
    this.daysLoading.set(true);
    try {
      const days = await this.bookingService.slots(serviceId, today(), 7, this.source()?.id);
      this.days.set(days);
      if (!this.date() || !days.some(d => d.date === this.date())) this.date.set(days.find(d => d.slots.some(s => s.available))?.date ?? days[0]?.date ?? null);
      const day = days.find(d => d.date === this.date());
      if (!day?.slots.some(s => s.time === this.time() && s.available)) this.time.set(null);
    } finally {
      this.daysLoading.set(false);
    }
  }

  /** Runs a step action; a taken slot sends the user back to pick another time. */
  private async run(action: () => Promise<void>): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      await action();
    } catch (e) {
      this.error.set(errorMessage(e));
      if (e instanceof HttpErrorResponse && e.status === 409 && this.step() === 4) {
        this.time.set(null);
        this.step.set(3);
      }
    } finally {
      this.busy.set(false);
    }
  }

  private reset(): void {
    this.step.set(1);
    this.source.set(null);
    this.customer.set(null);
    this.customerIsNew.set(false);
    this.phone.reset('');
    this.newName.reset('');
    this.lookup.set('idle');
    this.petId.set(null);
    this.addingPet.set(false);
    this.serviceId.set(null);
    this.date.set(null);
    this.time.set(null);
    this.amountType.set('full');
    this.error.set(null);
    this.done.set(null);
  }

  protected durationText(minutes: number | undefined): string {
    return minutes ? formatDuration(minutes) : '';
  }
}
