import { Component, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';

// ── Types ─────────────────────────────────────────────────────

type PetType    = 'dog' | 'cat';
type WizardStep = 1 | 2 | 3 | 4;

interface StepDef      { num: number; label: string; }
interface ServiceOption { label: string; price: string; amount: number; }
interface Slot          { time: string; available: boolean; }
interface SlotGroup     { period: string; icon: string; slots: Slot[]; }
interface DateShortcut  { label: string; isoDate: string; }

// ── Helpers ───────────────────────────────────────────────────

function isoDate(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
}

// ── Static data ───────────────────────────────────────────────

const WIZARD_STEPS: StepDef[] = [
  { num: 1, label: 'Pet & service' },
  { num: 2, label: 'Pick a slot'   },
  { num: 3, label: 'Confirm & pay' },
];

const DOG_SERVICES: ServiceOption[] = [
  { label: 'Signature Bath',        price: '₹1,200', amount: 1200 },
  { label: 'Full Groom & Style',    price: '₹2,500', amount: 2500 },
  { label: 'Royal Package',         price: '₹4,500', amount: 4500 },
  { label: 'Nail Trim & Filing',    price: '₹400',   amount:  400 },
  { label: 'De-shedding Treatment', price: '₹1,800', amount: 1800 },
  { label: 'Flea & Tick Spa',       price: '₹1,500', amount: 1500 },
];

const CAT_SERVICES: ServiceOption[] = [
  { label: 'Gentle Cat Bath',        price: '₹900',   amount:  900 },
  { label: 'Full Groom & Trim',      price: '₹2,000', amount: 2000 },
  { label: 'Nail Trim & Filing',     price: '₹350',   amount:  350 },
  { label: 'De-shedding Treatment',  price: '₹1,400', amount: 1400 },
  { label: 'Royale Cat Package',     price: '₹3,500', amount: 3500 },
  { label: 'Flea & Tick Spa',        price: '₹1,200', amount: 1200 },
];

const SLOT_GROUPS: SlotGroup[] = [
  {
    period: 'Morning', icon: '🌤️',
    slots: [
      { time: '9:00 AM',  available: true  },
      { time: '9:30 AM',  available: true  },
      { time: '10:00 AM', available: false },
      { time: '10:30 AM', available: true  },
      { time: '11:00 AM', available: false },
      { time: '11:30 AM', available: true  },
    ],
  },
  {
    period: 'Afternoon', icon: '☀️',
    slots: [
      { time: '2:00 PM',  available: true  },
      { time: '2:30 PM',  available: true  },
      { time: '3:00 PM',  available: true  },
      { time: '3:30 PM',  available: false },
      { time: '4:00 PM',  available: true  },
      { time: '4:30 PM',  available: true  },
    ],
  },
];

// ─────────────────────────────────────────────────────────────

@Component({
  selector: 'pp-booking',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './booking.component.html',
  styleUrl: './booking.component.scss',
})
export class BookingComponent {
  // ── Wizard state ──────────────────────────────────────────
  protected currentStep = signal<WizardStep>(1);
  protected wizardSteps = WIZARD_STEPS;

  // ── Step 1 ────────────────────────────────────────────────
  protected petType      = signal<PetType>('dog');
  protected petName      = signal('');
  protected breed        = signal('');
  protected serviceIndex = signal(0);

  // ── Step 2 ────────────────────────────────────────────────
  protected slotGroups   = SLOT_GROUPS;
  protected selectedDate = signal('');
  protected selectedSlot = signal('');

  protected dateShortcuts: DateShortcut[] = [
    { label: 'Today',     isoDate: isoDate(0) },
    { label: 'Tomorrow',  isoDate: isoDate(1) },
    { label: 'In 2 days', isoDate: isoDate(2) },
  ];

  protected todayDate = isoDate(0);

  // ── Computed ──────────────────────────────────────────────
  protected serviceOptions = computed(() =>
    this.petType() === 'dog' ? DOG_SERVICES : CAT_SERVICES
  );

  protected selectedService = computed(() =>
    this.serviceOptions()[this.serviceIndex()] ?? this.serviceOptions()[0]
  );

  protected remainingBalance = computed(() =>
    `₹${(this.selectedService().amount - 100).toLocaleString('en-IN')}`
  );

  // Validation gates
  protected step1Valid = computed(() => this.petName().trim().length > 0);
  protected step2Valid = computed(() =>
    this.selectedDate().length > 0 && this.selectedSlot().length > 0
  );

  // ── Step status ───────────────────────────────────────────
  stepStatus(step: StepDef): 'done' | 'active' | '' {
    const s = this.currentStep();
    if (s > step.num) return 'done';
    if (s === step.num) return 'active';
    return '';
  }

  // ── Slot helpers ──────────────────────────────────────────
  availableCount(group: SlotGroup): number {
    return group.slots.filter(s => s.available).length;
  }

  // ── Interactions ──────────────────────────────────────────
  selectPet(type: PetType): void {
    this.petType.set(type);
    this.serviceIndex.set(0);
  }

  selectSlot(slot: Slot): void {
    if (!slot.available) return;
    this.selectedSlot.set(slot.time);
  }

  setDate(iso: string): void {
    this.selectedDate.set(iso);
    this.selectedSlot.set(''); // reset slot when date changes
  }

  confirmBooking(): void {
    this.goToStep(4);
  }

  goToStep(n: WizardStep): void {
    this.currentStep.set(n);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ── Input handlers ────────────────────────────────────────
  onPetNameChange(e: Event): void {
    this.petName.set((e.target as HTMLInputElement).value);
  }

  onBreedChange(e: Event): void {
    this.breed.set((e.target as HTMLInputElement).value);
  }

  onDateChange(e: Event): void {
    this.setDate((e.target as HTMLInputElement).value);
  }

  onServiceChange(e: Event): void {
    this.serviceIndex.set(+(e.target as HTMLSelectElement).value);
  }
}
