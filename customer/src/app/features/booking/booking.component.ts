import { Component, ChangeDetectionStrategy, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { LoginDialogService } from '../../core/services/login-dialog.service';
import { Booking, TimeSlot } from '../../core/models/booking.model';
import { BOOKING_DEPOSIT_PAISE, BOOKING_WINDOW_DAYS, FREE_CANCELLATION_HOURS } from '../../core/constants/app.constants';
import { dateLabel, dateLongLabel, timeRangeLabel, upcomingDates } from '../../core/utils/date.utils';
import { BookingService } from '../../core/services/booking.service';
import { CatalogService } from '../../core/services/catalog.service';
import { PetDialogService } from '../../core/services/pet-dialog.service';
import { PetType } from '../../core/models/pet.model';
import { PET_EMOJI } from '../../core/constants/pet.constants';
import { petAgeLabel } from '../../core/utils/pet.utils';
import { errorMessage } from '../../core/utils/error.utils';
import { PetService } from '../../core/services/pet.service';
import { DateStripComponent } from '../../shared/components/date-strip/date-strip.component';
import { DurationPipe } from '../../shared/pipes/duration.pipe';
import { InrPipe } from '../../shared/pipes/inr.pipe';
import { SlotGridComponent } from '../../shared/components/slot-grid/slot-grid.component';

type Step = 'service' | 'slot' | 'pet' | 'review' | 'payment' | 'done';
type PaymentMethod = 'upi' | 'card' | 'netbanking';

const STEPS: { id: Exclude<Step, 'done'>; label: string }[] = [
  { id: 'service', label: 'Service' },
  { id: 'slot', label: 'Date & time' },
  { id: 'pet', label: 'Pet' },
  { id: 'review', label: 'Review' },
  { id: 'payment', label: 'Payment' },
];

const PAYMENT_METHODS: { id: PaymentMethod; icon: string; name: string; hint: string }[] = [
  { id: 'upi', icon: '📱', name: 'UPI', hint: 'Google Pay, PhonePe, Paytm' },
  { id: 'card', icon: '💳', name: 'Debit / credit card', hint: 'Visa, Mastercard, RuPay' },
  { id: 'netbanking', icon: '🏦', name: 'Net banking', hint: 'All major banks' },
];

/** Stand-in for the payment gateway's processing time until a real one is added. */
const DUMMY_PAYMENT_MS = 1500;

/**
 * Slot-booking flow: service -> date & time -> pet -> review -> payment -> confirmed.
 * Browsing is open to everyone; login is asked for only when moving on to pick a pet.
 * "Book" buttons open it with optional `pet`, `service` and `petId` query params to prefill it.
 */
@Component({
  selector: 'pp-booking',
  imports: [RouterLink, NgTemplateOutlet, DateStripComponent, SlotGridComponent, InrPipe, DurationPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './booking.component.html',
  styleUrl: './booking.component.scss',
})
export class BookingComponent {
  private catalog = inject(CatalogService);
  private bookingService = inject(BookingService);
  private loginDialog = inject(LoginDialogService);
  private petDialog = inject(PetDialogService);
  protected petService = inject(PetService);

  /** Query params. */
  readonly pet = input<string>();
  readonly service = input<string>();
  readonly petId = input<string>();

  protected readonly steps = STEPS;
  protected readonly paymentMethods = PAYMENT_METHODS;
  protected readonly dates = upcomingDates(BOOKING_WINDOW_DAYS);
  protected readonly depositPaise = BOOKING_DEPOSIT_PAISE;
  protected readonly freeCancellationHours = FREE_CANCELLATION_HOURS;
  protected readonly petEmoji = PET_EMOJI;
  protected readonly petAgeLabel = petAgeLabel;
  protected readonly dateLabel = dateLabel;
  protected readonly dateLongLabel = dateLongLabel;
  protected readonly timeRangeLabel = timeRangeLabel;

  protected step = signal<Step>('service');
  protected petType = signal<PetType>('dog');
  protected serviceId = signal<string | null>(null);
  protected date = signal<string | null>(this.dates[0]);
  protected time = signal<string | null>(null);
  protected chosenPetId = signal<string | null>(null);
  protected notes = signal('');
  protected slots = signal<TimeSlot[]>([]);
  protected slotsLoading = signal(false);
  protected submitting = signal(false);
  protected error = signal<string | null>(null);
  protected confirmed = signal<Booking | null>(null);
  protected paymentMethod = signal<PaymentMethod>('upi');
  protected paymentRef = signal('');

  protected services = computed(() => this.catalog.servicesFor(this.petType()));
  protected selectedService = computed(() => this.catalog.serviceById(this.serviceId()));
  protected matchingPets = computed(() => this.petService.pets().filter(p => p.type === this.petType()));
  protected otherPets = computed(() => this.petService.pets().filter(p => p.type !== this.petType()));
  /** The chosen pet, or the only one that fits so a one-pet household skips a tap. */
  protected selectedPet = computed(() => {
    const pets = this.matchingPets();
    return pets.find(p => p.id === this.chosenPetId()) ?? (pets.length === 1 ? pets[0] : undefined);
  });

  protected stepIndex = computed(() => STEPS.findIndex(s => s.id === this.step()));
  protected freeSlots = computed(() => this.slots().filter(s => s.available).length);
  protected nextDate = computed(() => this.dates[this.dates.indexOf(this.date() ?? '') + 1] ?? null);
  protected balancePaise = computed(() => Math.max(0, (this.selectedService()?.pricePaise ?? 0) - BOOKING_DEPOSIT_PAISE));
  protected canContinue = computed(() => {
    switch (this.step()) {
      case 'service': return !!this.selectedService();
      case 'slot': return !!this.date() && !!this.time() && !this.slotsLoading();
      case 'pet': return !!this.selectedPet();
      case 'review': return true;
      case 'payment': return !this.submitting();
      default: return false;
    }
  });

  private slotRequest = 0;

  constructor() {
    effect(() => {
      const pet = this.pet();
      const service = this.service();
      const petId = this.petId();
      untracked(() => this.reset(pet, service, petId));
    });

    effect(() => {
      const date = this.date();
      const serviceId = this.selectedService()?.id;
      untracked(() => void this.loadSlots(date, serviceId));
    });
  }

  async next(): Promise<void> {
    if (!this.canContinue()) return;
    this.error.set(null);
    switch (this.step()) {
      case 'service':
        this.goTo('slot');
        break;
      case 'slot':
        if (await this.loginDialog.ensureLoggedIn()) this.goTo('pet');
        break;
      case 'pet':
        this.goTo('review');
        break;
      case 'review':
        this.goTo('payment');
        break;
      case 'payment':
        await this.payAndConfirm();
        break;
    }
  }

  back(): void {
    const prev = STEPS[this.stepIndex() - 1];
    if (prev) this.goTo(prev.id);
  }

  goTo(step: Step): void {
    this.step.set(step);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  switchPetType(type: PetType): void {
    this.petType.set(type);
    if (this.selectedService()?.petType !== type) this.serviceId.set(null);
    if (this.step() !== 'service') this.goTo('service');
  }

  addPet(): void {
    this.petDialog.open();
  }

  bookAnother(): void {
    this.reset(this.petType(), undefined, undefined);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  onNotesChange(e: Event): void {
    this.notes.set((e.target as HTMLTextAreaElement).value);
  }

  private async payAndConfirm(): Promise<void> {
    const service = this.selectedService();
    const pet = this.selectedPet();
    const date = this.date();
    const time = this.time();
    if (!service || !pet || !date || !time || this.submitting()) return;

    this.submitting.set(true);
    try {
      // Dummy payment: no gateway yet, so wait briefly and treat the slot hold as paid.
      await new Promise(resolve => setTimeout(resolve, DUMMY_PAYMENT_MS));
      const notes = this.notes().trim();
      const booking = await this.bookingService.book({
        serviceId: service.id, petId: pet.id, date, time,
        ...(notes && { notes }),
      });
      this.confirmed.set(booking);
      this.paymentRef.set(`DEMO-${booking.id.slice(0, 8).toUpperCase()}`);
      this.goTo('done');
    } catch (e) {
      if (e instanceof HttpErrorResponse && e.status === 409) {
        // Someone else took the slot first: show fresh times.
        this.error.set(errorMessage(e));
        this.time.set(null);
        void this.loadSlots(date, service.id);
        this.goTo('slot');
      } else {
        this.error.set(errorMessage(e, 'Could not complete your booking. Please try again.'));
      }
    } finally {
      this.submitting.set(false);
    }
  }

  private async loadSlots(date: string | null, serviceId: string | undefined): Promise<void> {
    const request = ++this.slotRequest;
    if (!date || !serviceId) {
      this.slots.set([]);
      this.slotsLoading.set(false);
      return;
    }
    this.slotsLoading.set(true);
    try {
      const slots = await this.bookingService.getSlots(date, serviceId);
      if (request !== this.slotRequest) return;
      this.slots.set(slots);
      if (!slots.some(s => s.time === this.time() && s.available)) this.time.set(null);
    } catch {
      if (request === this.slotRequest) this.slots.set([]);
    } finally {
      if (request === this.slotRequest) this.slotsLoading.set(false);
    }
  }

  /** Start over, prefilled from the link that opened the flow. */
  private reset(pet: string | undefined, serviceId: string | undefined, petId: string | undefined): void {
    this.petType.set(pet === 'cat' ? 'cat' : 'dog');
    this.serviceId.set(serviceId ?? null);
    this.chosenPetId.set(petId ?? null);
    this.date.set(this.dates[0]);
    this.time.set(null);
    this.notes.set('');
    this.error.set(null);
    this.confirmed.set(null);
    this.paymentMethod.set('upi');
    this.step.set(serviceId ? 'slot' : 'service');
  }
}
