import { Component, signal, computed, inject, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BookingDialogService } from '../../core/services/booking-dialog.service';
import { LoginDialogService } from '../../core/auth/login-dialog.service';
import { SubscribeDialogService } from '../../core/services/subscribe-dialog.service';

export type PetType = 'dog' | 'cat';

interface Service {
  icon: string;
  name: string;
  desc: string;
  price: string;
  duration: string;
}

interface HowStep {
  num: string;
  title: string;
  desc: string;
}

interface HowFeature {
  icon: string;
  title: string;
  desc: string;
}

interface Plan {
  name: string;
  tagline: string;
  price: string;
  period: string;
  featured: boolean;
  badge?: string;
  buttonType: 'primary' | 'outline';
  features: { text: string; included: boolean }[];
}

interface Testimonial {
  quote: string;
  initial: string;
  name: string;
  pet: string;
}

interface GalleryItem {
  emoji: string;
  label: string;
}

// ── Data ──────────────────────────────────────────────────────

const DOG_SERVICES: Service[] = [
  { icon: '🛁', name: 'Signature Bath',        desc: 'A deep cleanse using premium organic shampoos, blow-dry, and light fragrance. Leaves your pet fresh for days.',                           price: '₹1,200', duration: '45 min'  },
  { icon: '✂️', name: 'Full Groom & Style',    desc: 'Bath, breed-specific haircut, nail trim, ear cleaning, and a finishing spritz. The complete experience.',                                price: '₹2,500', duration: '90 min'  },
  { icon: '👑', name: 'Royal Package',          desc: 'Our signature full groom plus de-shedding treatment, teeth brushing, and a paw massage. The ultimate indulgence.',                      price: '₹4,500', duration: '2.5 hrs' },
  { icon: '💅', name: 'Nail Trim & Filing',     desc: 'Precise nail clipping and filing to keep your pet comfortable and your furniture safe.',                                                 price: '₹400',   duration: '20 min'  },
  { icon: '🌿', name: 'De-shedding Treatment',  desc: 'Specialised treatment to reduce shedding by up to 80%. Ideal for double-coat breeds during seasonal changes.',                          price: '₹1,800', duration: '60 min'  },
  { icon: '🐾', name: 'Flea & Tick Spa',        desc: 'A medicated treatment bath that eliminates fleas and ticks using vet-approved, pet-safe solutions.',                                    price: '₹1,500', duration: '60 min'  },
];

const CAT_SERVICES: Service[] = [
  { icon: '🛁', name: 'Gentle Cat Bath',        desc: 'A calm, stress-free bath using fragrance-free organic formulas — ideal even for cats that dislike water.',                              price: '₹900',   duration: '40 min'  },
  { icon: '✂️', name: 'Full Groom & Trim',      desc: 'Breed-specific coat trim, nail clipping, ear cleaning, and a gentle blow-dry finish.',                                                 price: '₹2,000', duration: '75 min'  },
  { icon: '💅', name: 'Nail Trim & Filing',      desc: 'Careful nail trimming to prevent overgrowth and scratching. Done by patient, cat-experienced groomers.',                               price: '₹350',   duration: '15 min'  },
  { icon: '🌿', name: 'De-shedding Treatment',   desc: 'Reduces loose fur and hairballs with a deep-conditioning treatment. Great for long-haired breeds.',                                    price: '₹1,400', duration: '50 min'  },
  { icon: '👑', name: 'Royale Cat Package',       desc: 'The full experience — bath, trim, nail filing, ear cleaning, de-shed, and a calming paw massage.',                                   price: '₹3,500', duration: '2 hrs'   },
  { icon: '🐾', name: 'Flea & Tick Spa',          desc: 'Medicated, vet-approved treatment that safely eliminates fleas and ticks while being gentle on your cat.',                            price: '₹1,200', duration: '50 min'  },
];

const HOW_STEPS: HowStep[] = [
  { num: '1', title: 'Choose a service & slot',     desc: "Browse our services, pick your preferred date and time. Real-time availability shows you exactly what's open." },
  { num: '2', title: 'Confirm with ₹100 hold',      desc: 'A small refundable hold secures your slot instantly. Pay the balance when you arrive — no surprises.' },
  { num: '3', title: 'Get a WhatsApp confirmation', desc: "Your booking details, timing, and location are sent immediately to your WhatsApp. We'll remind you the evening before." },
];

const HOW_FEATURES: HowFeature[] = [
  { icon: '🌿',  title: '100% pet-safe products',  desc: 'Imported organic, sulphate-free formulas' },
  { icon: '👨‍⚕️', title: 'Certified groomers',      desc: 'Trained, experienced, breed-specialist staff' },
  { icon: '📍',  title: 'Central Pune location',    desc: 'Easy access, ample parking, calm environment' },
  { icon: '📸',  title: 'Post-groom photo update',  desc: 'We send you a photo when your pet is done' },
  { icon: '🔄',  title: 'Easy rescheduling',        desc: 'Cancel or reschedule up to 24 hrs in advance' },
];

const PLANS: Plan[] = [
  {
    name: 'Basic', tagline: 'For the occasional grooming visit',
    price: '₹499', period: '/ month', featured: false, buttonType: 'outline',
    features: [
      { text: '2 grooming sessions',   included: true  },
      { text: 'WhatsApp reminders',    included: true  },
      { text: 'Pet profile & history', included: true  },
      { text: 'Priority slot booking', included: false },
      { text: 'Service discounts',     included: false },
      { text: 'Post-groom photos',     included: false },
    ],
  },
  {
    name: 'Posh', tagline: 'For the devoted pet parent',
    price: '₹999', period: '/ month', featured: true, badge: 'Most popular', buttonType: 'primary',
    features: [
      { text: '5 grooming sessions',   included: true  },
      { text: 'WhatsApp reminders',    included: true  },
      { text: 'Pet profile & history', included: true  },
      { text: 'Priority slot booking', included: true  },
      { text: '10% off all services',  included: true  },
      { text: 'Post-groom photos',     included: false },
    ],
  },
  {
    name: 'Royal', tagline: 'The ultimate pet pampering',
    price: '₹1,999', period: '/ month', featured: false, buttonType: 'outline',
    features: [
      { text: 'Unlimited sessions',    included: true },
      { text: 'WhatsApp reminders',    included: true },
      { text: 'Pet profile & history', included: true },
      { text: 'Priority slot booking', included: true },
      { text: '20% off all services',  included: true },
      { text: 'Post-groom photos',     included: true },
    ],
  },
];

const GALLERY_ITEMS: GalleryItem[] = [
  { emoji: '🐕',    label: 'Golden Retriever' },
  { emoji: '🐈',    label: 'Persian Cat'      },
  { emoji: '🐩',    label: 'Poodle'           },
  { emoji: '🐈‍⬛',   label: 'Maine Coon'       },
  { emoji: '🦮',    label: 'Labrador'          },
  { emoji: '🐾',    label: 'Shih Tzu'          },
];

const TESTIMONIALS: Testimonial[] = [
  {
    quote:   '"Bruno came back looking absolutely stunning. The team handled him with so much care — he\'s usually anxious but was completely relaxed."',
    initial: 'P', name: 'Priya Sharma',  pet: 'Golden Retriever owner · Koregaon Park',
  },
  {
    quote:   '"I\'ve tried 4 groomers in Pune. Posh Paws is in a different league. The Royal Package for my Persian cat was worth every rupee."',
    initial: 'R', name: 'Rohan Mehta',   pet: 'Persian cat owner · Baner',
  },
  {
    quote:   '"The WhatsApp photo they sent when Coco was done made my whole day. Such a thoughtful touch. We\'re Royal members now and won\'t go anywhere else."',
    initial: 'A', name: 'Ananya Desai',  pet: 'Shih Tzu owner · Viman Nagar',
  },
];

const TRUST_PILLS = ['Certified groomers', 'Imported products', 'Fear-free certified', 'Vet recommended'];

// ─────────────────────────────────────────────────────────────

@Component({
  selector: 'pp-home',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent {
  private bookingDialog = inject(BookingDialogService);
  private subscribeDialog = inject(SubscribeDialogService);
  private login = inject(LoginDialogService);

  protected activePet    = signal<PetType>('dog');
  protected services     = computed(() => this.activePet() === 'dog' ? DOG_SERVICES : CAT_SERVICES);
  protected howSteps     = HOW_STEPS;
  protected howFeatures  = HOW_FEATURES;
  protected plans        = PLANS;
  protected galleryItems = GALLERY_ITEMS;
  protected testimonials = TESTIMONIALS;
  protected trustPills   = TRUST_PILLS;

  switchPet(pet: PetType): void {
    this.activePet.set(pet);
  }

  openBookingDialog(): void {
    this.bookingDialog.open({ petType: this.activePet() });
  }

  async subscribeToPlan(plan: Plan): Promise<void> {
    if (!(await this.login.ensureLoggedIn())) return;
    this.subscribeDialog.open(plan);
  }
}
