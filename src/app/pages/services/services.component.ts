import { Component, signal, computed, inject, ChangeDetectionStrategy } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { BookingDialogService } from '../../core/services/booking-dialog.service';

export type PetType = 'dog' | 'cat';

export interface Service {
  icon: string;
  name: string;
  desc: string;
  price: string;
  duration: string;
}

export interface HowStep {
  num: string;
  title: string;
  desc: string;
}

export interface HowFeature {
  icon: string;
  title: string;
  desc: string;
}

const DOG_SERVICES: Service[] = [
  {
    icon: '🛁',
    name: 'Signature Bath',
    desc: 'A deep cleanse using premium organic shampoos, blow-dry, and light fragrance. Leaves your pet fresh for days.',
    price: '₹1,200',
    duration: '45 min',
  },
  {
    icon: '✂️',
    name: 'Full Groom & Style',
    desc: 'Bath, breed-specific haircut, nail trim, ear cleaning, and a finishing spritz. The complete experience.',
    price: '₹2,500',
    duration: '90 min',
  },
  {
    icon: '👑',
    name: 'Royal Package',
    desc: 'Our signature full groom plus de-shedding treatment, teeth brushing, and a paw massage. The ultimate indulgence.',
    price: '₹4,500',
    duration: '2.5 hrs',
  },
  {
    icon: '💅',
    name: 'Nail Trim & Filing',
    desc: 'Precise nail clipping and filing to keep your pet comfortable and your furniture safe.',
    price: '₹400',
    duration: '20 min',
  },
  {
    icon: '🌿',
    name: 'De-shedding Treatment',
    desc: 'Specialised treatment to reduce shedding by up to 80%. Ideal for double-coat breeds during seasonal changes.',
    price: '₹1,800',
    duration: '60 min',
  },
  {
    icon: '🐾',
    name: 'Flea & Tick Spa',
    desc: 'A medicated treatment bath that eliminates fleas and ticks using vet-approved, pet-safe solutions.',
    price: '₹1,500',
    duration: '60 min',
  },
];

const CAT_SERVICES: Service[] = [
  {
    icon: '🛁',
    name: 'Gentle Cat Bath',
    desc: 'A calm, stress-free bath using fragrance-free organic formulas — ideal even for cats that dislike water.',
    price: '₹900',
    duration: '40 min',
  },
  {
    icon: '✂️',
    name: 'Full Groom & Trim',
    desc: 'Breed-specific coat trim, nail clipping, ear cleaning, and a gentle blow-dry finish.',
    price: '₹2,000',
    duration: '75 min',
  },
  {
    icon: '💅',
    name: 'Nail Trim & Filing',
    desc: 'Careful nail trimming to prevent overgrowth and scratching. Done by patient, cat-experienced groomers.',
    price: '₹350',
    duration: '15 min',
  },
  {
    icon: '🌿',
    name: 'De-shedding Treatment',
    desc: 'Reduces loose fur and hairballs with a deep-conditioning treatment. Great for long-haired breeds.',
    price: '₹1,400',
    duration: '50 min',
  },
  {
    icon: '👑',
    name: 'Royale Cat Package',
    desc: 'The full experience — bath, trim, nail filing, ear cleaning, de-shed, and a calming paw massage.',
    price: '₹3,500',
    duration: '2 hrs',
  },
  {
    icon: '🐾',
    name: 'Flea & Tick Spa',
    desc: 'Medicated, vet-approved treatment that safely eliminates fleas and ticks while being gentle on your cat.',
    price: '₹1,200',
    duration: '50 min',
  },
];

const HOW_STEPS: HowStep[] = [
  {
    num: '1',
    title: 'Choose a service & slot',
    desc: 'Browse our services, pick your preferred date and time. Real-time availability shows you exactly what\'s open.',
  },
  {
    num: '2',
    title: 'Confirm with ₹100 hold',
    desc: 'A small refundable hold secures your slot instantly. Pay the balance when you arrive — no surprises.',
  },
  {
    num: '3',
    title: 'Get a WhatsApp confirmation',
    desc: 'Your booking details, timing, and location are sent immediately to your WhatsApp. We\'ll remind you the evening before.',
  },
];

const HOW_FEATURES: HowFeature[] = [
  { icon: '🌿', title: '100% pet-safe products',    desc: 'Imported organic, sulphate-free formulas' },
  { icon: '👨‍⚕️', title: 'Certified groomers',        desc: 'Trained, experienced, breed-specialist staff' },
  { icon: '📍', title: 'Central Pune location',     desc: 'Easy access, ample parking, calm environment' },
  { icon: '📸', title: 'Post-groom photo update',   desc: 'We send you a photo when your pet is done' },
  { icon: '🔄', title: 'Easy rescheduling',         desc: 'Cancel or reschedule up to 24 hrs in advance' },
];

@Component({
  selector: 'pp-services',
  standalone: true,
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './services.component.html',
  styleUrl:    './services.component.scss',
})
export class ServicesComponent {
  private bookingDialog = inject(BookingDialogService);

  protected activePet   = signal<PetType>('dog');
  protected services    = computed(() => this.activePet() === 'dog' ? DOG_SERVICES : CAT_SERVICES);
  protected howSteps    = HOW_STEPS;
  protected howFeatures = HOW_FEATURES;

  switchPet(pet: PetType): void {
    this.activePet.set(pet);
  }

  openBookingDialog(): void {
    this.bookingDialog.open({ petType: this.activePet() });
  }

  bookService(service: Service): void {
    this.bookingDialog.open({ petType: this.activePet(), serviceName: service.name });
  }
}
