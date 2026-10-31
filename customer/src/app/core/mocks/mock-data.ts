import { PlanItem, ServiceItem } from '../models/catalog.model';

// Data the fake API serves until the backend is live. It becomes the backend's seed data.

/** The one-time code that logs anyone in while mocks are on. */
export const MOCK_OTP = '123456';

export const SERVICES: ServiceItem[] = [
  { id: 'dog-signature-bath', petType: 'dog', icon: '🛁', name: 'Signature Bath',
    description: 'A deep cleanse using premium organic shampoos, blow-dry, and light fragrance. Leaves your pet fresh for days.',
    pricePaise: 120000, durationMinutes: 45 },
  { id: 'dog-full-groom-style', petType: 'dog', icon: '✂️', name: 'Full Groom & Style',
    description: 'Bath, breed-specific haircut, nail trim, ear cleaning, and a finishing spritz. The complete experience.',
    pricePaise: 250000, durationMinutes: 90 },
  { id: 'dog-royal-package', petType: 'dog', icon: '👑', name: 'Royal Package',
    description: 'Our signature full groom plus de-shedding treatment, teeth brushing, and a paw massage. The ultimate indulgence.',
    pricePaise: 450000, durationMinutes: 150 },
  { id: 'dog-nail-trim-filing', petType: 'dog', icon: '💅', name: 'Nail Trim & Filing',
    description: 'Precise nail clipping and filing to keep your pet comfortable and your furniture safe.',
    pricePaise: 40000, durationMinutes: 20 },
  { id: 'dog-de-shedding-treatment', petType: 'dog', icon: '🌿', name: 'De-shedding Treatment',
    description: 'Specialised treatment to reduce shedding by up to 80%. Ideal for double-coat breeds during seasonal changes.',
    pricePaise: 180000, durationMinutes: 60 },
  { id: 'dog-flea-tick-spa', petType: 'dog', icon: '🐾', name: 'Flea & Tick Spa',
    description: 'A medicated treatment bath that eliminates fleas and ticks using vet-approved, pet-safe solutions.',
    pricePaise: 150000, durationMinutes: 60 },
  { id: 'cat-gentle-cat-bath', petType: 'cat', icon: '🛁', name: 'Gentle Cat Bath',
    description: 'A calm, stress-free bath using fragrance-free organic formulas — ideal even for cats that dislike water.',
    pricePaise: 90000, durationMinutes: 40 },
  { id: 'cat-full-groom-trim', petType: 'cat', icon: '✂️', name: 'Full Groom & Trim',
    description: 'Breed-specific coat trim, nail clipping, ear cleaning, and a gentle blow-dry finish.',
    pricePaise: 200000, durationMinutes: 75 },
  { id: 'cat-nail-trim-filing', petType: 'cat', icon: '💅', name: 'Nail Trim & Filing',
    description: 'Careful nail trimming to prevent overgrowth and scratching. Done by patient, cat-experienced groomers.',
    pricePaise: 35000, durationMinutes: 15 },
  { id: 'cat-de-shedding-treatment', petType: 'cat', icon: '🌿', name: 'De-shedding Treatment',
    description: 'Reduces loose fur and hairballs with a deep-conditioning treatment. Great for long-haired breeds.',
    pricePaise: 140000, durationMinutes: 50 },
  { id: 'cat-royale-cat-package', petType: 'cat', icon: '👑', name: 'Royale Cat Package',
    description: 'The full experience — bath, trim, nail filing, ear cleaning, de-shed, and a calming paw massage.',
    pricePaise: 350000, durationMinutes: 120 },
  { id: 'cat-flea-tick-spa', petType: 'cat', icon: '🐾', name: 'Flea & Tick Spa',
    description: 'Medicated, vet-approved treatment that safely eliminates fleas and ticks while being gentle on your cat.',
    pricePaise: 120000, durationMinutes: 50 },
];

export const PLANS: PlanItem[] = [
  {
    id: 'basic', name: 'Basic', tagline: 'For the occasional grooming visit', pricePaise: 49900, billing: 'month', featured: false,
    features: [
      { text: '2 grooming sessions', included: true },
      { text: 'WhatsApp reminders', included: true },
      { text: 'Pet profile & history', included: true },
      { text: 'Priority slot booking', included: false },
      { text: 'Service discounts', included: false },
      { text: 'Post-groom photos', included: false },
    ],
  },
  {
    id: 'posh', name: 'Posh', tagline: 'For the devoted pet parent', pricePaise: 99900, billing: 'month', featured: true, badge: 'Most popular',
    features: [
      { text: '5 grooming sessions', included: true },
      { text: 'WhatsApp reminders', included: true },
      { text: 'Pet profile & history', included: true },
      { text: 'Priority slot booking', included: true },
      { text: '10% off all services', included: true },
      { text: 'Post-groom photos', included: false },
    ],
  },
  {
    id: 'royal', name: 'Royal', tagline: 'The ultimate pet pampering', pricePaise: 199900, billing: 'month', featured: false,
    features: [
      { text: 'Unlimited sessions', included: true },
      { text: 'WhatsApp reminders', included: true },
      { text: 'Pet profile & history', included: true },
      { text: 'Priority slot booking', included: true },
      { text: '20% off all services', included: true },
      { text: 'Post-groom photos', included: true },
    ],
  },
];
