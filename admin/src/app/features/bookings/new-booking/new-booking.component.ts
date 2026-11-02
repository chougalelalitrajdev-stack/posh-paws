import { Component, ChangeDetectionStrategy, computed, inject, input, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { EMPTY, Observable, catchError, filter, finalize, map, of, switchMap, tap } from 'rxjs';
import { CALL_OUTCOMES, SOURCES } from '../../../core/constants/status.constants';
import { AmountType, Booking, BookingBill, BookingDetails, CallOutcome } from '../../../core/models/booking.model';
import { DayAvailability } from '../../../core/models/calendar.model';
import { PetType, Service } from '../../../core/models/catalog.model';
import { Customer, CustomerPet, CustomerPlan } from '../../../core/models/customer.model';
import { AlertService } from '../../../core/services/alert.service';
import { BookingService } from '../../../core/services/booking.service';
import { CatalogService } from '../../../core/services/catalog.service';
import { SettingsService } from '../../../core/services/settings.service';
import { TemplateService } from '../../../core/services/template.service';
import { CustomerService } from '../../../core/services/customer.service';
import { PetService } from '../../../core/services/pet.service';
import { formatPhone, telLink, whatsappLink } from '../../../core/utils/contact.utils';
import { formatDuration, monthYear, shortDate, today, whenLabel } from '../../../core/utils/date.utils';
import { errorMessage } from '../../../core/utils/error.utils';
import { discounted, formatInr } from '../../../core/utils/money.utils';
import { firstName } from '../../../core/utils/message.utils';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { SegmentedComponent } from '../../../shared/components/segmented/segmented.component';
import { SlotPickerComponent } from '../../../shared/components/slot-picker/slot-picker.component';
import { StatusPillComponent } from '../../../shared/components/status-pill/status-pill.component';
import { DurationPipe } from '../../../shared/pipes/duration.pipe';
import { InrPipe } from '../../../shared/pipes/inr.pipe';
import { BillComponent } from '../../../shared/components/bill/bill.component';
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
    SlotPickerComponent, BookingStepComponent, BillComponent, IconComponent, InrPipe, DurationPipe,
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
  private settings = inject(SettingsService);
  private templates = inject(TemplateService);

  /** Query params: the request or draft to continue, or a customer (and pet) to start with. */
  readonly from = input<string>();
  readonly customerId = input<string>(undefined, { alias: 'customer' });
  readonly petIdParam = input<string>(undefined, { alias: 'pet' });

  protected readonly callOutcomes = CALL_OUTCOMES;
  protected readonly sources = SOURCES;
  protected readonly holdPaise = this.settings.holdPaise;
  protected readonly linkHours = this.settings.linkHours;
  protected readonly rulesNote = this.settings.rulesNote;
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
  /** Step 4: phone bookings pay at the shop by default; a payment link is optional. */
  protected payWith = signal<'shop' | 'link'>('shop');
  protected offerInput = this.fb.control('');
  /** The offer code applied to the bill (after Apply). */
  protected offerCode = signal<string | null>(null);
  protected quoteError = signal<string | null>(null);
  /** The server's bill for the chosen service (member session or discount, or the offer). */
  protected bill = signal<BookingBill | null>(null);

  protected busy = signal(false);
  protected error = signal<string | null>(null);
  /** The booking once it's confirmed or its payment link exists. */
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
  /** What a payment link would ask for. */
  protected amount = computed(() => {
    const total = this.bill()?.totalPaise;
    if (total === undefined) return null;
    return this.amountType() === 'hold' ? Math.min(this.holdPaise(), total) : total;
  });
  /** A plan session covers this service for this member (shown in step 2). */
  protected coveredBySession = (s: Service) => {
    const plan = this.plan();
    return !!plan && plan.eligibleServiceIds.includes(s.id) && (plan.sessionsLeft === null || plan.sessionsLeft > 0);
  };
  protected when = computed(() => {
    const d = this.date();
    const t = this.time();
    return d && t ? `${shortDate(d)} · ${t}` : '';
  });
  protected message = computed(() =>
    this.templates.render('payment_link', {
      customer_name: firstName(this.customer()?.name ?? ''),
      pet_name: this.pet()?.name ?? 'Your pet',
      service: this.service()?.name ?? '[service]',
      date_time: this.when() || '[date and time]',
      amount: formatInr(this.amount() ?? 0),
      payment_link: this.done()?.paymentLink?.url ?? '[payment link]',
      link_hours: String(this.linkHours()),
    }),
  );
  /** After a phone booking is confirmed: the confirmation to send instead of a payment link. */
  protected confirmMessage = computed(() =>
    this.templates.render('booking_confirmed', {
      customer_name: firstName(this.customer()?.name ?? ''),
      pet_name: this.pet()?.name ?? 'Your pet',
      service: this.service()?.name ?? '[service]',
      date_time: this.when() || '[date and time]',
    }),
  );
  protected shareMessage = computed(() => (this.done()?.stage === 'confirmed' ? this.confirmMessage() : this.message()));
  protected whatsappHref = computed(() => {
    const c = this.customer();
    return c ? whatsappLink(c.phone, this.shareMessage()) : '';
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

  /** What the screen was opened with (query params). */
  private start = computed(() => ({ from: this.from(), customerId: this.customerId(), petId: this.petIdParam() }));
  /** What the bill depends on. */
  private quoteQuery = computed(() => {
    const c = this.customer();
    const s = this.serviceId();
    return c && s ? { customerId: c.id, serviceId: s, offerCode: this.offerCode() } : null;
  });
  /** The service whose slots step 3 shows; null outside step 3. */
  private slotService = computed(() => (this.step() === 3 ? this.service()?.id ?? null : null));

  constructor() {
    this.catalog.load().subscribe();
    this.settings.load().subscribe();
    this.templates.load().subscribe();

    // Opening another request or customer cancels the previous load (switchMap), so details never mix.
    toObservable(this.start).pipe(
      tap(() => this.reset()),
      switchMap(({ from, customerId, petId }) => (from ? this.loadSource(from) : customerId ? this.loadCustomer(customerId, petId) : EMPTY)),
      takeUntilDestroyed(),
    ).subscribe();

    // The bill follows the customer, service and offer code; a newer one cancels the older request.
    toObservable(this.quoteQuery).pipe(
      tap(() => this.bill.set(null)),
      switchMap(q => (q ? this.bookingService.quote(q).pipe(catchError(e => {
        // A code that can't be used: say why and price the booking without it.
        this.quoteError.set(errorMessage(e));
        this.offerCode.set(null);
        return of(null);
      })) : of(null))),
      takeUntilDestroyed(),
    ).subscribe(bill => {
      this.bill.set(bill);
      if (bill && !bill.totalPaise) this.payWith.set('shop'); // nothing to pay: no link needed
    });

    // Slots load each time step 3 opens; a newer service cancels the older request.
    toObservable(this.slotService).pipe(
      filter(id => id !== null),
      tap(() => this.daysLoading.set(true)),
      switchMap(id => this.bookingService.slots(id, today(), 7, this.source()?.id).pipe(catchError(() => of(null)))),
      takeUntilDestroyed(),
    ).subscribe(days => {
      this.daysLoading.set(false);
      if (days) this.applySlots(days);
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
  findCustomer(): void {
    if (this.phone.invalid) {
      this.phone.markAsTouched();
      return;
    }
    this.lookup.set('searching');
    this.error.set(null);
    this.customerService.findByPhone(this.phone.value).pipe(catchError(() => of(null))).subscribe(found => {
      if (found) {
        this.setCustomer(found, false);
        this.lookup.set('idle');
      } else {
        this.lookup.set('not-found');
      }
    });
  }

  createCustomer(): void {
    if (this.newName.invalid) {
      this.newName.markAsTouched();
      return;
    }
    this.run(this.customerService.create({ name: this.newName.value.trim(), phone: this.phone.value }).pipe(tap(c => {
      this.setCustomer(c, true);
      this.lookup.set('idle');
    })));
  }

  changeCustomer(): void {
    this.customer.set(null);
    this.petId.set(null);
    this.serviceId.set(null);
    this.lookup.set('idle');
  }

  addPet(): void {
    const c = this.customer();
    if (!c || this.petForm.invalid) {
      this.petForm.markAllAsTouched();
      return;
    }
    const { name, type, breed } = this.petForm.getRawValue();
    this.run(this.petService.add(c.id, { name: name.trim(), type, ...(breed.trim() && { breed: breed.trim() }) }).pipe(tap(pet => {
      this.customer.set({ ...c, pets: [...c.pets, pet] });
      this.petId.set(pet.id);
      this.addingPet.set(false);
      this.petForm.reset({ name: '', type: 'dog', breed: '' });
    })));
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
  applyOffer(): void {
    const code = this.offerInput.value.trim().toUpperCase();
    this.quoteError.set(null);
    this.offerCode.set(code || null);
  }

  clearOffer(): void {
    this.offerInput.setValue('');
    this.quoteError.set(null);
    this.offerCode.set(null);
  }

  /** Phone booking: confirmed now, everything paid at the shop. */
  confirmBooking(): void {
    this.run(this.bookingService.saveDetails(this.details(), this.source()?.id).pipe(
      tap(saved => this.source.set(saved)),
      switchMap(saved => this.bookingService.confirm(saved.id)),
      tap(booking => this.done.set(booking)),
    ));
  }

  createLink(copy: boolean): void {
    this.run(this.bookingService.saveDetails(this.details(), this.source()?.id).pipe(
      tap(saved => this.source.set(saved)),
      switchMap(saved => this.bookingService.sendPaymentLink(saved.id, this.amountType())),
      tap(booking => {
        this.done.set(booking);
        if (copy) void this.copy(booking.paymentLink!.url, 'Payment link copied.');
      }),
    ));
  }

  saveDraft(): void {
    if (!this.canSaveDraft()) return;
    this.run(this.bookingService.saveDetails(this.details(), this.source()?.id).pipe(tap(saved => {
      this.source.set(saved);
      this.alert.success(`Draft saved as ${saved.id}.`);
    })));
  }

  setOutcome(outcome: string): void {
    const b = this.source();
    if (!b) return;
    this.bookingService.setCallOutcome(b.id, outcome as CallOutcome).subscribe(updated => this.source.set(updated));
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
    return { customerId: this.customer()!.id, petId: this.petId()!, serviceId: this.serviceId()!, date: this.date(), time: this.time(), offerCode: this.offerCode() };
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

  /** Continues a request or draft: the booking, then its customer (services must be loaded to match the request). */
  private loadSource(id: string): Observable<unknown> {
    this.loadingSource.set(true);
    return this.catalog.load().pipe(
      switchMap(() => this.bookingService.get(id)),
      switchMap(b => this.customerService.get(b.customer.id).pipe(map(c => ({ b, c })))),
      tap(({ b, c }) => {
        this.source.set(b);
        this.setCustomer(c, false);
        // A draft keeps the offer code it was saved with.
        if (b.offerCode) {
          this.offerInput.setValue(b.offerCode);
          this.offerCode.set(b.offerCode);
        }
        if (b.pet) this.petId.set(b.pet.id);
        this.serviceId.set(b.service?.id ?? (this.pet() ? this.matchRequestedService(this.pet()!.type) : null));
        this.date.set(b.date);
        this.time.set(b.time);
      }),
      catchError(() => EMPTY),
      finalize(() => this.loadingSource.set(false)),
    );
  }

  private loadCustomer(customerId: string, petId?: string): Observable<unknown> {
    this.loadingSource.set(true);
    return this.catalog.load().pipe(
      switchMap(() => this.customerService.get(customerId)),
      tap(c => {
        this.setCustomer(c, false);
        if (petId && c.pets.some(p => p.id === petId)) this.petId.set(petId);
      }),
      catchError(() => EMPTY),
      finalize(() => this.loadingSource.set(false)),
    );
  }

  /** Keeps the picked day and time if they're still offered; otherwise picks the first day with a free slot. */
  private applySlots(days: DayAvailability[]): void {
    this.days.set(days);
    if (!this.date() || !days.some(d => d.date === this.date())) this.date.set(days.find(d => d.slots.some(s => s.available))?.date ?? days[0]?.date ?? null);
    const day = days.find(d => d.date === this.date());
    if (!day?.slots.some(s => s.time === this.time() && s.available)) this.time.set(null);
  }

  /** Runs one step action at a time; a taken slot (409) sends the user back to pick another time. */
  private run(action: Observable<unknown>): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    action.pipe(finalize(() => this.busy.set(false))).subscribe({
      error: e => {
        this.error.set(errorMessage(e));
        if (e instanceof HttpErrorResponse && e.status === 409 && this.step() === 4) {
          this.time.set(null);
          this.step.set(3);
        }
      },
    });
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
    this.payWith.set('shop');
    this.offerInput.reset('');
    this.offerCode.set(null);
    this.quoteError.set(null);
    this.error.set(null);
    this.done.set(null);
  }

  protected durationText(minutes: number | undefined): string {
    return minutes ? formatDuration(minutes) : '';
  }
}
