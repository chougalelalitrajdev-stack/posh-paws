import { Component, signal, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';

export interface PlanFeature {
  text: string;
  included: boolean;
}

export interface Plan {
  name: string;
  tagline: string;
  price: string;
  period: string;
  featured: boolean;
  badge?: string;
  buttonType: 'primary' | 'outline';
  features: PlanFeature[];
}

export interface Perk {
  icon: string;
  title: string;
  desc: string;
}

export interface FaqItem {
  q: string;
  a: string;
}

const PLANS: Plan[] = [
  {
    name: 'Basic',
    tagline: 'For the occasional grooming visit',
    price: '₹499',
    period: '/ month',
    featured: false,
    buttonType: 'outline',
    features: [
      { text: '2 grooming sessions',    included: true  },
      { text: 'WhatsApp reminders',     included: true  },
      { text: 'Pet profile & history',  included: true  },
      { text: 'Priority slot booking',  included: false },
      { text: 'Service discounts',      included: false },
      { text: 'Post-groom photos',      included: false },
    ],
  },
  {
    name: 'Posh',
    tagline: 'For the devoted pet parent',
    price: '₹999',
    period: '/ month',
    featured: true,
    badge: 'Most popular',
    buttonType: 'primary',
    features: [
      { text: '5 grooming sessions',    included: true  },
      { text: 'WhatsApp reminders',     included: true  },
      { text: 'Pet profile & history',  included: true  },
      { text: 'Priority slot booking',  included: true  },
      { text: '10% off all services',   included: true  },
      { text: 'Post-groom photos',      included: false },
    ],
  },
  {
    name: 'Royal',
    tagline: 'The ultimate pet pampering',
    price: '₹1,999',
    period: '/ month',
    featured: false,
    buttonType: 'outline',
    features: [
      { text: 'Unlimited sessions',     included: true },
      { text: 'WhatsApp reminders',     included: true },
      { text: 'Pet profile & history',  included: true },
      { text: 'Priority slot booking',  included: true },
      { text: '20% off all services',   included: true },
      { text: 'Post-groom photos',      included: true },
    ],
  },
];

const PERKS: Perk[] = [
  {
    icon: '🗓️',
    title: 'Priority slots',
    desc: 'Members get first pick of every week\'s calendar before slots open to walk-ins. No more waiting.',
  },
  {
    icon: '💰',
    title: 'Real savings',
    desc: 'Posh and Royal members save between ₹400–₹800 per month compared to booking individually.',
  },
  {
    icon: '📋',
    title: 'Pet profile',
    desc: 'We remember your pet\'s breed, coat, sensitivities, and groomer preferences — every single visit.',
  },
  {
    icon: '📸',
    title: 'Post-groom photos',
    desc: 'Royal members receive a fresh photo on WhatsApp the moment their pet\'s session is complete.',
  },
];

const FAQ: FaqItem[] = [
  {
    q: 'Can I cancel or change my plan anytime?',
    a: 'Yes. You can upgrade, downgrade, or cancel your membership at any time before the next billing cycle. No lock-in, no penalties.',
  },
  {
    q: 'Do unused sessions roll over to the next month?',
    a: 'Sessions are valid for the calendar month. They do not roll over, so we recommend booking early to make the most of your plan.',
  },
  {
    q: 'Can I use my membership for both dogs and cats?',
    a: 'Absolutely. Your membership covers all pets linked to your profile. Add multiple pets and the sessions are shared across them.',
  },
  {
    q: 'How does the ₹100 slot hold work for members?',
    a: 'Members still place a ₹100 refundable hold to confirm a booking. It is fully returned when you arrive for the appointment.',
  },
];

@Component({
  selector: 'pp-membership',
  standalone: true,
  imports: [RouterLink, CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './membership.component.html',
  styleUrl:    './membership.component.scss',
})
export class MembershipComponent {
  protected plans  = PLANS;
  protected perks  = PERKS;
  protected faq    = FAQ;

  // Tracks which FAQ index is open; null = all collapsed
  protected openFaq = signal<number | null>(null);

  toggleFaq(index: number): void {
    this.openFaq.update(current => current === index ? null : index);
  }
}
