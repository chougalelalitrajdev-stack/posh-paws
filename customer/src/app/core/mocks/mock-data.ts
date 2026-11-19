import { PlanItem, ServiceItem, ShopInfo } from '../models/catalog.model';
import { Banner, FaqData, GalleryData, PageKey, SitePage } from '../models/content.model';

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

/** Plan rules the server keeps (the admin's Membership plans): sessions per month, discount, services a session covers. */
export const PLAN_RULES: Record<string, { sessionsPerPeriod: number | null; discountPercent: number; eligibleServiceIds: string[] }> = {
  basic: { sessionsPerPeriod: 2, discountPercent: 0, eligibleServiceIds: ['dog-signature-bath', 'dog-nail-trim-filing', 'cat-gentle-cat-bath', 'cat-nail-trim-filing'] },
  posh: {
    sessionsPerPeriod: 5, discountPercent: 10,
    eligibleServiceIds: [
      'dog-signature-bath', 'dog-nail-trim-filing', 'dog-full-groom-style', 'dog-de-shedding-treatment',
      'cat-gentle-cat-bath', 'cat-nail-trim-filing', 'cat-full-groom-trim', 'cat-de-shedding-treatment',
    ],
  },
  royal: { sessionsPerPeriod: null, discountPercent: 20, eligibleServiceIds: SERVICES.map(s => s.id) },
};

export interface MockOffer {
  code: string;
  title: string;
  type: 'percent' | 'flat';
  /** Percent, or paise when flat. */
  value: number;
  /** null = every service. */
  serviceIds: string[] | null;
}

/** Offer codes customers can enter at checkout (the admin's Offers). Each code works once per customer. */
export const OFFERS: MockOffer[] = [
  { code: 'FRIEND200', title: 'Refer a friend', type: 'flat', value: 20000, serviceIds: null },
  {
    code: 'DIWALI20', title: 'Diwali grooming week', type: 'percent', value: 20,
    serviceIds: ['dog-signature-bath', 'dog-full-groom-style', 'dog-royal-package', 'dog-de-shedding-treatment', 'dog-flea-tick-spa', 'dog-nail-trim-filing'],
  },
];

/** Settings › Payments in the admin. */
export const SHOP: ShopInfo = {
  business: {
    name: 'Posh Paws Pet Grooming', phone: '+91 00000 00000', whatsapp: '+91 00000 00000', email: 'hello@poshpaws.in',
    instagram: '@poshpaws.pune', mapsLink: '', address: '123, Posh Paws Lane, Koregaon Park, Pune 411001',
  },
  hours: [0, 1, 2, 3, 4, 5, 6].map(day => ({ day, open: true, opens: day === 6 ? '10:00' : '09:00', closes: day === 6 ? '17:00' : '19:00' })),
  advancePaise: 10000, freeCancellationHours: 24, upiId: 'poshpaws@upi', qrImageUrl: null,
};

// ── Content (the admin's Content › Banners, Gallery, Pages & FAQs) ──

const PAW = 'M12 14c-2.5 0-5 2-5 4.5 0 1.7 1.3 2.5 2.7 2.5 1 0 1.5-.5 2.3-.5s1.3.5 2.3.5c1.4 0 2.7-.8 2.7-2.5 0-2.5-2.5-4.5-5-4.5zM5.5 11a1.8 2.2 0 1 0 0-4.4 1.8 2.2 0 0 0 0 4.4zM9.5 7a1.8 2.2 0 1 0 0-4.4 1.8 2.2 0 0 0 0 4.4zM14.5 7a1.8 2.2 0 1 0 0-4.4 1.8 2.2 0 0 0 0 4.4zM18.5 11a1.8 2.2 0 1 0 0-4.4 1.8 2.2 0 0 0 0 4.4z';

/** A small coloured stand-in picture with a paw print, for demo photos and banners. */
function picture(color: string, width = 1200, height = 900): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="${color}"/>`
    + `<g transform="translate(${width / 2 - 60} ${height / 2 - 60}) scale(5)" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="1.4"><path d="${PAW}"/></g></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export const BANNERS: Banner[] = [
  { id: 'ban-1', placement: 'home_hero', title: 'Diwali grooming week', subtitle: '20% off every dog service, with the code DIWALI20.', buttonText: 'Book with 20% off',
    link: 'book', imageUrl: picture('#2D6A4F', 1080, 1350), desktopImageUrl: picture('#2D6A4F', 1920, 720) },
  { id: 'ban-4', placement: 'home_promo', title: 'Refer a friend, get ₹200', subtitle: 'Your friend gets ₹200 off their first groom too.', buttonText: 'Book now',
    link: 'book', imageUrl: null, desktopImageUrl: null },
  { id: 'ban-5', placement: 'services', title: 'New: De-shedding Treatment', subtitle: 'Less shedding at home after one session.', buttonText: 'See it',
    link: 'services', imageUrl: null, desktopImageUrl: null },
];

export const GALLERY: GalleryData = {
  categories: [{ id: 'gc-grooming', name: 'Grooming' }, { id: 'gc-before-after', name: 'Before & after' }, { id: 'gc-happy', name: 'Happy pets' },
    { id: 'gc-studio', name: 'Studio' }],
  photos: ([
    ['Bruno after his Royal Package', 'gc-happy', 'Golden Retriever', '#C9A26B'], ['Luna, freshly brushed', 'gc-grooming', 'Persian', '#B8A99A'],
    ['Before and after: Rocky', 'gc-before-after', 'German Shepherd', '#7E6B55'], ['Our grooming room', 'gc-studio', '', '#5F7F6C'],
    ['Mia at the flea spa', 'gc-grooming', 'Siamese', '#A89580'], ['Pumpkin after a cat bath', 'gc-grooming', 'Ragdoll', '#C2B3A3'],
    ['Daisy loves the dryer', 'gc-happy', 'Beagle', '#B48A5E'],
  ] as const).map(([caption, categoryId, pet, color], i) => ({ id: `ph-${i + 1}`, imageUrl: picture(color), caption, categoryId, pet })),
};

const STORY = 'Posh Paws was born from a simple belief: every pet deserves the same quality of care their owner gives themselves. We started in a small studio in Koregaon Park and have grown into Pune’s most trusted grooming sanctuary, one happy pet at a time.\n\n'
  + 'Our groomers are certified professionals who genuinely love animals. We use only imported, pet-safe, sulphate-free products: nothing harsh, nothing that doesn’t belong near your companion.';

export const PAGES: Record<PageKey, SitePage> = {
  home: { key: 'home', title: 'Home page', sections: [
    { id: 'home-hero', heading: 'Your pet deserves only the finest.', body: 'Premium grooming rituals crafted with love, for cats and dogs. By appointment, because your pet’s time matters too.' },
    { id: 'home-services', heading: 'Grooming rituals for every pet', body: '' },
    { id: 'home-plans', heading: 'Choose your plan', body: '' },
    { id: 'home-story', heading: 'Six years of caring for Pune’s pets', body: STORY },
    { id: 'home-gallery', heading: 'Happy pets, every time', body: '' },
    { id: 'home-reviews', heading: 'What pet parents say', body: '' },
  ] },
  about: { key: 'about', title: 'About', sections: [
    { id: 'about-intro', heading: 'Six years of caring for Pune’s pets', body: STORY },
    { id: 'about-values', heading: 'The values behind every session', body: 'Only safe products. Imported, organic, sulphate-free formulas.\n\nCertified groomers. Every groomer on our team is trained, certified and passionate about animal welfare.\n\n'
      + 'Fear-free approach. We move at your pet’s pace. Calm handling, gentle techniques, no rush.\n\nHonest pricing. No hidden fees, no surprise add-ons.' },
  ] },
  terms: { key: 'terms', title: 'Terms of service', sections: [{ id: 'terms-body', heading: 'Terms of service', body: '[Your terms of service]' }] },
  privacy: { key: 'privacy', title: 'Privacy policy', sections: [{ id: 'privacy-body', heading: 'Privacy policy', body: '[Your privacy policy]' }] },
};

export const FAQS: FaqData = {
  groups: [{ id: 'fg-booking', name: 'Booking', shownOn: 'Services, Booking' }, { id: 'fg-membership', name: 'Membership', shownOn: 'Membership' },
    { id: 'fg-pets', name: 'Pets and safety', shownOn: 'About, Services' }],
  faqs: [
    { id: 'faq-1', groupId: 'fg-booking', question: 'How do I book a slot?', answer: 'Tap Book now, pick a service, a time and your pet, then confirm with a ₹100 hold. We send the confirmation on WhatsApp.' },
    { id: 'faq-2', groupId: 'fg-booking', question: 'Can I reschedule?', answer: 'Yes, up to 24 hours before your slot at no charge.' },
    { id: 'faq-4', groupId: 'fg-membership', question: 'Can I cancel or change my plan anytime?', answer: 'Yes. You can upgrade, downgrade, or cancel your membership at any time before the next billing cycle. No lock-in, no penalties.' },
    { id: 'faq-5', groupId: 'fg-membership', question: 'Do unused sessions roll over to the next month?', answer: 'Sessions are valid for the calendar month. They do not roll over, so we recommend booking early to make the most of your plan.' },
    { id: 'faq-6', groupId: 'fg-membership', question: 'Can I use my membership for both dogs and cats?', answer: 'Absolutely. Your membership covers all pets linked to your profile. Add multiple pets and the sessions are shared across them.' },
    { id: 'faq-7', groupId: 'fg-membership', question: 'How does the ₹100 slot hold work for members?', answer: 'Members still place a ₹100 refundable hold to confirm a booking. It is fully returned when you arrive for the appointment.' },
    { id: 'faq-8', groupId: 'fg-pets', question: 'Is my pet safe with anxious handling?', answer: 'We follow a fear-free approach and move at your pet’s pace.' },
    { id: 'faq-9', groupId: 'fg-pets', question: 'Do you need vaccination records?', answer: 'Yes, please share them before the first visit.' },
  ],
};
