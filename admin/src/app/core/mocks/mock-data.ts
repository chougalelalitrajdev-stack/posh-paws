import { ActivityEntry, AmountType, Booking, BookingSource, BookingStage, PaymentStatus, RequestInfo } from '../models/booking.model';
import { Station } from '../models/catalog.model';
import { GalleryPhoto } from '../models/gallery.model';
import { Faq, FaqGroup, PageSection, SitePage } from '../models/page.model';
import { Settings } from '../models/settings.model';
import { MessageTemplate, TemplateKey } from '../models/template.model';
import { Offer } from '../models/offer.model';
import { Plan } from '../models/plan.model';
import { CustomerPet, StaffNote } from '../models/customer.model';
import { Subscription, SubscriptionStatus } from '../models/subscription.model';
import { StaffUser, TeamMember } from '../models/staff-user.model';
import { addDays, slotStart, today } from '../utils/date.utils';
import type { StoredBanner, StoredCategory, StoredCustomer, StoredService } from './mock-db';
import { discounted } from '../utils/money.utils';

// Data the fake API serves until the backend is live. It becomes the backend's seed data.
// Names, pets and numbers follow the admin design. Booking dates are relative to today.

/** Password for every demo account while mocks are on. */
export const MOCK_PASSWORD = 'pawsword';

/** Demo staff accounts, one per role. */
export const STAFF: StaffUser[] = [
  { id: 'st-1', name: 'Sanjay R.', email: 'owner@poshpaws.in', role: 'super_admin' },
  { id: 'st-2', name: 'Meera K.', email: 'meera@poshpaws.in', role: 'admin' },
  { id: 'st-3', name: 'Amit J.', email: 'amit@poshpaws.in', role: 'staff' },
];

/** Catalog seed: the same services as the customer app (Catalog › Services edits them). */
export const SERVICES: StoredService[] = [
  { id: 'dog-signature-bath', petType: 'dog', name: 'Signature Bath', category: 'Bath', pricePaise: 120000, durationMinutes: 45, sortOrder: 0, visible: true, archived: false,
    description: 'A deep cleanse using premium organic shampoos, blow-dry, and light fragrance. Leaves your pet fresh for days.' },
  { id: 'dog-full-groom-style', petType: 'dog', name: 'Full Groom & Style', category: 'Haircut', pricePaise: 250000, durationMinutes: 90, sortOrder: 1, visible: true, archived: false,
    description: 'Bath, breed-specific haircut, nail trim, ear cleaning, and a finishing spritz. The complete experience.' },
  { id: 'dog-royal-package', petType: 'dog', name: 'Royal Package', category: 'Package', pricePaise: 450000, durationMinutes: 150, sortOrder: 2, visible: true, archived: false,
    description: 'Our signature full groom plus de-shedding treatment, teeth brushing, and a paw massage. The ultimate indulgence.' },
  { id: 'dog-nail-trim-filing', petType: 'dog', name: 'Nail Trim & Filing', category: 'Add-on', pricePaise: 40000, durationMinutes: 20, sortOrder: 3, visible: true, archived: false,
    description: 'Precise nail clipping and filing to keep your pet comfortable and your furniture safe.' },
  { id: 'dog-de-shedding-treatment', petType: 'dog', name: 'De-shedding Treatment', category: 'Treatment', pricePaise: 180000, durationMinutes: 60, sortOrder: 4, visible: true, archived: false,
    description: 'Specialised treatment to reduce shedding by up to 80%. Ideal for double-coat breeds during seasonal changes.' },
  { id: 'dog-flea-tick-spa', petType: 'dog', name: 'Flea & Tick Spa', category: 'Treatment', pricePaise: 150000, durationMinutes: 60, sortOrder: 5, visible: true, archived: false,
    description: 'A medicated treatment bath that eliminates fleas and ticks using vet-approved, pet-safe solutions.' },
  { id: 'cat-gentle-cat-bath', petType: 'cat', name: 'Gentle Cat Bath', category: 'Bath', pricePaise: 90000, durationMinutes: 40, sortOrder: 0, visible: true, archived: false,
    description: 'A calm, stress-free bath using fragrance-free organic formulas — ideal even for cats that dislike water.' },
  { id: 'cat-full-groom-trim', petType: 'cat', name: 'Full Groom & Trim', category: 'Haircut', pricePaise: 200000, durationMinutes: 75, sortOrder: 1, visible: true, archived: false,
    description: 'Breed-specific coat trim, nail clipping, ear cleaning, and a gentle blow-dry finish.' },
  { id: 'cat-nail-trim-filing', petType: 'cat', name: 'Nail Trim & Filing', category: 'Add-on', pricePaise: 35000, durationMinutes: 15, sortOrder: 2, visible: true, archived: false,
    description: 'Careful nail trimming to prevent overgrowth and scratching. Done by patient, cat-experienced groomers.' },
  { id: 'cat-de-shedding-treatment', petType: 'cat', name: 'De-shedding Treatment', category: 'Treatment', pricePaise: 140000, durationMinutes: 50, sortOrder: 3, visible: true, archived: false,
    description: 'Reduces loose fur and hairballs with a deep-conditioning treatment. Great for long-haired breeds.' },
  { id: 'cat-royale-cat-package', petType: 'cat', name: 'Royale Cat Package', category: 'Package', pricePaise: 350000, durationMinutes: 120, sortOrder: 4, visible: true, archived: false,
    description: 'The full experience — bath, trim, nail filing, ear cleaning, de-shed, and a calming paw massage.' },
  { id: 'cat-flea-tick-spa', petType: 'cat', name: 'Flea & Tick Spa', category: 'Treatment', pricePaise: 120000, durationMinutes: 50, sortOrder: 5, visible: true, archived: false,
    description: 'Medicated, vet-approved treatment that safely eliminates fleas and ticks while being gentle on your cat.' },
  // Archived (Services › Archived in the design)
  { id: 'dog-teeth-cleaning', petType: 'dog', name: 'Teeth Cleaning', category: 'Add-on', pricePaise: 50000, durationMinutes: 20, sortOrder: 6, visible: false, archived: true,
    description: 'Gentle brushing with enzymatic pet toothpaste for fresher breath.' },
  { id: 'cat-paw-balm', petType: 'cat', name: 'Paw Balm Treatment', category: 'Add-on', pricePaise: 30000, durationMinutes: 15, sortOrder: 6, visible: false, archived: true,
    description: 'Moisturising balm for dry, cracked paw pads.' },
];

export const STATIONS: Station[] = [
  { id: 'st1', name: 'Station 1' },
  { id: 'st2', name: 'Station 2' },
];

/** Settings seed. The booking rules are the ones the app has used so far (09:00–19:00, lunch 14:00–14:30, 15 min buffer). */
export const SETTINGS: Omit<Settings, 'booking'> & { booking: Omit<Settings['booking'], 'closures'> } = {
  business: {
    name: 'Posh Paws Pet Grooming', phone: '+91 [YOUR NUMBER]', whatsapp: '+91 [YOUR NUMBER]', email: 'hello@poshpaws.in',
    instagram: '@poshpaws.pune', mapsLink: '', address: '[Your address], Koregaon Park, Pune',
  },
  booking: {
    hours: [0, 1, 2, 3, 4, 5, 6].map(day => ({ day, open: true, opens: '09:00', closes: '19:00', breakFrom: '14:00', breakTo: '14:30' })),
    slotStepMinutes: 30, bufferMinutes: 15, bookAheadDays: 30, minNoticeMinutes: 30,
  },
  payments: { currency: 'INR', linkExpiryHours: 24, slotHoldPaise: 10000, provider: null },
  notifications: { reminderTime: '18:00', unpaidNudgeHours: 6, staffAlerts: 'admins' },
  app: { bookButtonText: 'Book now', showPrices: true },
};

/** Membership plans seed (Catalog › Membership plans edits them). */
export const PLANS: Omit<Plan, 'activeSubscribers'>[] = [
  {
    id: 'basic', name: 'Basic', tagline: 'For the occasional grooming visit', pricePaise: 49900, billing: 'month',
    sessionsPerPeriod: 2, discountPercent: 0, featured: false, subscribable: true,
    eligibleServiceIds: ['dog-signature-bath', 'dog-nail-trim-filing', 'cat-gentle-cat-bath', 'cat-nail-trim-filing'],
    benefits: [
      { text: '2 grooming sessions', included: true }, { text: 'WhatsApp reminders', included: true }, { text: 'Pet profile & history', included: true },
      { text: 'Priority slot booking', included: false }, { text: 'Service discounts', included: false }, { text: 'Post-groom photos', included: false },
    ],
  },
  {
    id: 'posh', name: 'Posh', tagline: 'For the devoted pet parent', pricePaise: 99900, billing: 'month',
    sessionsPerPeriod: 5, discountPercent: 10, featured: true, subscribable: true,
    eligibleServiceIds: ['dog-signature-bath', 'dog-nail-trim-filing', 'dog-full-groom-style', 'dog-de-shedding-treatment', 'cat-gentle-cat-bath', 'cat-nail-trim-filing', 'cat-full-groom-trim', 'cat-de-shedding-treatment'],
    benefits: [
      { text: '5 grooming sessions', included: true }, { text: 'WhatsApp reminders', included: true }, { text: 'Pet profile & history', included: true },
      { text: 'Priority slot booking', included: true }, { text: '10% off all services', included: true }, { text: 'Post-groom photos', included: false },
    ],
  },
  {
    id: 'royal', name: 'Royal', tagline: 'The ultimate pet pampering', pricePaise: 199900, billing: 'month',
    sessionsPerPeriod: null, discountPercent: 20, featured: false, subscribable: true,
    eligibleServiceIds: [
      'dog-signature-bath', 'dog-nail-trim-filing', 'dog-full-groom-style', 'dog-de-shedding-treatment', 'dog-flea-tick-spa', 'dog-royal-package',
      'cat-gentle-cat-bath', 'cat-nail-trim-filing', 'cat-full-groom-trim', 'cat-de-shedding-treatment', 'cat-flea-tick-spa', 'cat-royale-cat-package',
    ],
    benefits: [
      { text: 'Unlimited sessions', included: true }, { text: 'WhatsApp reminders', included: true }, { text: 'Pet profile & history', included: true },
      { text: 'Priority slot booking', included: true }, { text: '20% off all services', included: true }, { text: 'Post-groom photos', included: true },
    ],
  },
];

const daysAgoIso = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

export function seedCustomers(): StoredCustomer[] {
  const c = (id: string, name: string, phone: string, sinceDaysAgo: number, extra: { email?: string; area?: string; staffNote?: StaffNote }, pets: CustomerPet[]): StoredCustomer =>
    ({ id, name, phone, customerSince: daysAgoIso(sinceDaysAgo), ...extra, pets });
  return [
    c('c1', 'Ananya Desai', '9822041763', 970, { email: 'ananya.desai@example.com', area: 'Viman Nagar, Pune', staffNote: { text: 'Prefers evening slots and WhatsApp over calls. Coco gets anxious with dryers; towel-dry first.', by: 'Meera K.', at: daysAgoIso(29) } }, [
      { id: 'p1', name: 'Coco', type: 'dog', breed: 'Shih Tzu', birthDate: '2022-06-01', gender: 'female', weightKg: 6, coat: 'Small · long', temperament: 'Anxious', vaccination: 'up_to_date', notes: 'Anxious with hair dryers; towel-dry first and keep the room quiet.', healthNotes: 'No known allergies.' },
      { id: 'p2', name: 'Pepper', type: 'dog', breed: 'Indie', birthDate: '2024-04-10', gender: 'male', weightKg: 14, coat: 'Medium · short', temperament: 'Playful', vaccination: 'due_soon', notes: 'Loves treats; wriggles during nail trims.', healthNotes: 'Rabies booster due soon.' },
    ]),
    c('c2', 'Priya Sharma', '9876543210', 730, { email: 'priya.s@example.com', area: 'Koregaon Park, Pune' }, [
      { id: 'p3', name: 'Bruno', type: 'dog', breed: 'Golden Retriever', birthDate: '2023-02-14', gender: 'male', weightKg: 31, coat: 'Large · double', temperament: 'Calm, friendly', vaccination: 'up_to_date', notes: 'Royal Package regular. Likes the paw massage.', healthNotes: 'Mild skin sensitivity, use oatmeal shampoo.' },
    ]),
    c('c3', 'Rohan Mehta', '9765430981', 650, { area: 'Baner, Pune' }, [
      { id: 'p4', name: 'Luna', type: 'cat', breed: 'Persian', birthDate: '2024-01-05', gender: 'female', weightKg: 4, coat: 'Small · long', temperament: 'Calm, shy with strangers', vaccination: 'up_to_date', notes: 'Sensitive ears. Calm, but shy with strangers; let her settle before drying.' },
    ]),
    c('c4', 'Neha Kulkarni', '9850766124', 480, {}, [
      { id: 'p5', name: 'Tiger', type: 'dog', breed: 'Indie', birthDate: '2021-09-01', gender: 'male', coat: 'Medium · short', vaccination: 'unknown' },
    ]),
    c('c5', 'Aditi Nair', '9923450876', 440, { area: 'Kalyani Nagar, Pune' }, [
      { id: 'p6', name: 'Mia', type: 'cat', breed: 'Siamese', birthDate: '2020-05-01', gender: 'female', weightKg: 3.5, coat: 'Small · short', temperament: 'Vocal', vaccination: 'up_to_date', notes: 'Hisses at first, settles in five minutes.', healthNotes: 'On a kidney-care diet.' },
    ]),
    c('c6', 'Sameer Khan', '9881230457', 850, { email: 'sameer.k@example.com' }, [
      { id: 'p7', name: 'Rocky', type: 'dog', breed: 'German Shepherd', birthDate: '2019-03-01', gender: 'male', weightKg: 36, coat: 'Large · double', temperament: 'Calm', vaccination: 'up_to_date', notes: 'Needs help on and off the table (hips).', healthNotes: 'Mild hip dysplasia.' },
      { id: 'p8', name: 'Kaju', type: 'dog', breed: 'Pug', birthDate: '2023-12-01', gender: 'male', coat: 'Small · short', vaccination: 'up_to_date' },
    ]),
    c('c7', 'Karan Joshi', '9890411220', 136, {}, [
      { id: 'p9', name: 'Max', type: 'dog', breed: 'Beagle', birthDate: '2025-06-01', gender: 'male', weightKg: 10, coat: 'Medium · short', temperament: 'Playful', vaccination: 'not_vaccinated', notes: 'First groom was a while ago.', healthNotes: 'Puppy vaccinations pending, ask before booking.' },
    ]),
    c('c8', 'Isha Patil', '9730018862', 600, {}, [
      { id: 'p10', name: 'Bella', type: 'dog', breed: 'Pomeranian', birthDate: '2022-01-01', gender: 'female', coat: 'Small · double', vaccination: 'up_to_date' },
    ]),
    c('c9', 'Arjun Mehta', '9822177310', 630, {}, [
      { id: 'p11', name: 'Oreo', type: 'cat', breed: 'Maine Coon', birthDate: '2023-04-01', gender: 'male', coat: 'Large · long', vaccination: 'up_to_date', notes: 'Mats behind the ears.' },
    ]),
    c('c10', 'Vikram Rao', '9970122845', 540, {}, [
      { id: 'p12', name: 'Leo', type: 'dog', breed: 'Labrador', birthDate: '2022-08-01', gender: 'male', coat: 'Large · short', vaccination: 'up_to_date' },
    ]),
    c('c11', 'Farah Shaikh', '9890155532', 270, { area: 'Wanowrie, Pune' }, [
      { id: 'p13', name: 'Mochi', type: 'cat', breed: 'Persian', birthDate: '2024-02-01', gender: 'female', coat: 'Long', vaccination: 'up_to_date' },
    ]),
    c('c12', 'Dev Malhotra', '9819044781', 11, {}, [
      { id: 'p14', name: 'Bolt', type: 'dog', breed: 'Indie', birthDate: '2024-07-01', gender: 'male', coat: 'Medium · short', vaccination: 'unknown' },
    ]),
    c('c13', 'Kavya Iyer', '9867011223', 715, {}, [
      { id: 'p15', name: 'Pumpkin', type: 'cat', breed: 'Ragdoll', birthDate: '2022-10-01', gender: 'female', coat: 'Long', vaccination: 'up_to_date' },
    ]),
    c('c14', 'Meghna Rao', '9833022110', 545, {}, [
      { id: 'p16', name: 'Zoe', type: 'dog', breed: 'Shih Tzu', birthDate: '2023-03-01', gender: 'female', coat: 'Small · long', vaccination: 'up_to_date' },
    ]),
    c('c15', 'Rahul Verma', '9920033441', 700, {}, [
      { id: 'p17', name: 'Simba', type: 'dog', breed: 'Labrador', birthDate: '2021-01-01', gender: 'male', coat: 'Large · short', vaccination: 'up_to_date' },
    ]),
    c('c16', 'Sneha Joshi', '9819900112', 437, {}, [
      { id: 'p18', name: 'Daisy', type: 'dog', breed: 'Beagle', birthDate: '2023-05-01', gender: 'female', coat: 'Medium · short', vaccination: 'up_to_date' },
    ]),
    c('c17', 'Nisha Kapoor', '9811177665', 3, {}, [
      { id: 'p19', name: 'Sheru', type: 'dog', breed: 'Indie', gender: 'male', vaccination: 'unknown' },
    ]),
  ];
}

interface SeedBooking {
  id: string;
  customer: string;
  pet: string;
  service?: string;
  stage: BookingStage;
  payment?: PaymentStatus;
  /** Created this many minutes before now. */
  createdMinutesAgo: number;
  source?: BookingSource;
  /** Days from today + HH:mm + station, when a slot is picked. */
  day?: number;
  time?: string;
  station?: string;
  amountType?: AmountType;
  /** Payment link sent / paid this many minutes before now. */
  sentMinutesAgo?: number;
  request?: RequestInfo;
}

const SEED_BOOKINGS: SeedBooking[] = [
  // Requests: new (no call yet) and called
  { id: 'PP-1053', customer: 'c12', pet: 'p14', stage: 'request', createdMinutesAgo: 4, request: { interestedIn: 'Not sure yet, wants advice', bestTime: 'Now' } },
  { id: 'PP-1052', customer: 'c11', pet: 'p13', stage: 'request', createdMinutesAgo: 12, request: { interestedIn: 'Gentle Cat Bath', bestTime: 'Any weekday morning' } },
  { id: 'PP-1051', customer: 'c1', pet: 'p1', stage: 'request', createdMinutesAgo: 42, request: { interestedIn: 'Royal Package', bestTime: 'Today after 5 pm', message: 'Coco needs a full groom before Diwali. Weekend is fine too.' } },
  { id: 'PP-1050', customer: 'c10', pet: 'p12', stage: 'request', createdMinutesAgo: 70, request: { interestedIn: 'De-shedding Treatment', bestTime: 'This weekend' } },
  { id: 'PP-1044', customer: 'c17', pet: 'p19', stage: 'request', createdMinutesAgo: 60 * 20, source: 'phone', request: { interestedIn: 'Full Groom & Style', bestTime: 'Evenings', callOutcome: 'no_answer' } },
  { id: 'PP-1043', customer: 'c15', pet: 'p17', stage: 'request', createdMinutesAgo: 60 * 3, request: { interestedIn: 'Flea & Tick Spa', bestTime: 'After 6 pm', callOutcome: 'call_back_later' } },
  // Draft and awaiting payment
  { id: 'PP-1049', customer: 'c7', pet: 'p9', service: 'dog-signature-bath', stage: 'draft', createdMinutesAgo: 60 * 16, request: { interestedIn: 'Signature Bath', bestTime: 'Weekend', callOutcome: 'reached' } },
  { id: 'PP-1048', customer: 'c3', pet: 'p4', service: 'cat-royale-cat-package', stage: 'awaiting_payment', payment: 'link_sent', createdMinutesAgo: 60 * 8, day: 2, time: '12:00', station: 'st2', amountType: 'full', sentMinutesAgo: 60 * 7, request: { interestedIn: 'Royale Cat Package', message: 'Luna is matted, any slot this week?', callOutcome: 'reached' } },
  { id: 'PP-1047', customer: 'c4', pet: 'p5', service: 'dog-full-groom-style', stage: 'awaiting_payment', payment: 'failed', createdMinutesAgo: 90, day: 2, time: '15:00', station: 'st1', amountType: 'full', sentMinutesAgo: 60, source: 'phone' },
  { id: 'PP-1046', customer: 'c14', pet: 'p16', service: 'dog-nail-trim-filing', stage: 'awaiting_payment', payment: 'link_sent', createdMinutesAgo: 60 * 26, day: 0, time: '12:00', station: 'st2', amountType: 'full', sentMinutesAgo: 60 * 25, source: 'phone' },
  // Today
  { id: 'PP-1040', customer: 'c6', pet: 'p7', service: 'dog-full-groom-style', stage: 'completed', payment: 'paid', createdMinutesAgo: 60 * 24 * 3, day: 0, time: '09:30', station: 'st1', amountType: 'full', sentMinutesAgo: 60 * 24 * 3, source: 'app' },
  { id: 'PP-1039', customer: 'c13', pet: 'p15', service: 'cat-gentle-cat-bath', stage: 'completed', payment: 'paid', createdMinutesAgo: 60 * 24 * 2, day: 0, time: '10:00', station: 'st2', amountType: 'full', sentMinutesAgo: 60 * 24 * 2, source: 'app' },
  { id: 'PP-1045', customer: 'c2', pet: 'p3', service: 'dog-royal-package', stage: 'confirmed', payment: 'paid', createdMinutesAgo: 60 * 24 * 2, day: 0, time: '11:30', station: 'st1', amountType: 'full', sentMinutesAgo: 60 * 24 * 2 - 30, source: 'app' },
  { id: 'PP-1038', customer: 'c15', pet: 'p17', service: 'dog-de-shedding-treatment', stage: 'confirmed', payment: 'paid', createdMinutesAgo: 60 * 24 * 4, day: 0, time: '15:00', station: 'st1', amountType: 'hold', sentMinutesAgo: 60 * 24 * 4, source: 'app' },
  { id: 'PP-1037', customer: 'c5', pet: 'p6', service: 'cat-flea-tick-spa', stage: 'confirmed', payment: 'paid', createdMinutesAgo: 60 * 24 * 3, day: 0, time: '16:30', station: 'st2', amountType: 'full', sentMinutesAgo: 60 * 24 * 3, source: 'app' },
  { id: 'PP-1036', customer: 'c16', pet: 'p18', service: 'dog-signature-bath', stage: 'confirmed', payment: 'paid', createdMinutesAgo: 60 * 24 * 5, day: 0, time: '17:00', station: 'st1', amountType: 'hold', sentMinutesAgo: 60 * 24 * 5, source: 'app' },
  // Coming days
  { id: 'PP-1035', customer: 'c6', pet: 'p8', service: 'dog-signature-bath', stage: 'confirmed', payment: 'paid', createdMinutesAgo: 60 * 24, day: 1, time: '10:00', station: 'st1', amountType: 'full', sentMinutesAgo: 60 * 23 },
  { id: 'PP-1034', customer: 'c1', pet: 'p2', service: 'dog-nail-trim-filing', stage: 'confirmed', payment: 'paid', createdMinutesAgo: 60 * 30, day: 3, time: '11:00', station: 'st2', amountType: 'hold', sentMinutesAgo: 60 * 29, source: 'app' },
  { id: 'PP-1033', customer: 'c2', pet: 'p3', service: 'dog-de-shedding-treatment', stage: 'confirmed', payment: 'paid', createdMinutesAgo: 60 * 40, day: 4, time: '16:00', station: 'st1', amountType: 'full', sentMinutesAgo: 60 * 39, source: 'app' },
  // Earlier
  { id: 'PP-1032', customer: 'c8', pet: 'p10', service: 'dog-nail-trim-filing', stage: 'no_show', payment: 'paid', createdMinutesAgo: 60 * 24 * 6, day: -2, time: '17:00', station: 'st1', amountType: 'hold', sentMinutesAgo: 60 * 24 * 6, source: 'app' },
  { id: 'PP-1031', customer: 'c9', pet: 'p11', service: 'cat-gentle-cat-bath', stage: 'cancelled', payment: 'refunded', createdMinutesAgo: 60 * 24 * 7, day: -3, time: '11:00', station: 'st2', amountType: 'full', sentMinutesAgo: 60 * 24 * 7, source: 'app' },
];

/** Completed, paid visits over the last six days (feeds the dashboard's payments chart). */
const HISTORY: [day: number, customer: string, pet: string, service: string, time: string, station: string][] = [
  [-1, 'c2', 'p3', 'dog-royal-package', '10:00', 'st1'], [-1, 'c5', 'p6', 'cat-gentle-cat-bath', '11:00', 'st2'], [-1, 'c13', 'p15', 'cat-full-groom-trim', '15:00', 'st2'],
  [-2, 'c6', 'p8', 'dog-full-groom-style', '09:30', 'st1'], [-2, 'c16', 'p18', 'dog-signature-bath', '12:00', 'st2'],
  [-3, 'c1', 'p1', 'dog-full-groom-style', '10:00', 'st1'], [-3, 'c15', 'p17', 'dog-royal-package', '15:00', 'st1'], [-3, 'c3', 'p4', 'cat-gentle-cat-bath', '16:30', 'st2'], [-3, 'c14', 'p16', 'dog-signature-bath', '11:00', 'st2'],
  [-4, 'c2', 'p3', 'dog-de-shedding-treatment', '09:00', 'st1'], [-4, 'c6', 'p7', 'dog-royal-package', '11:00', 'st2'], [-4, 'c11', 'p13', 'cat-full-groom-trim', '15:30', 'st2'], [-4, 'c14', 'p16', 'dog-flea-tick-spa', '17:00', 'st1'],
  [-5, 'c8', 'p10', 'dog-full-groom-style', '10:30', 'st1'], [-5, 'c5', 'p6', 'cat-de-shedding-treatment', '12:00', 'st2'], [-5, 'c1', 'p2', 'dog-signature-bath', '16:00', 'st1'],
  [-6, 'c10', 'p12', 'dog-signature-bath', '10:00', 'st1'], [-6, 'c13', 'p15', 'cat-gentle-cat-bath', '14:30', 'st2'],
  // Not seen in 90+ days
  [-135, 'c7', 'p9', 'dog-signature-bath', '11:00', 'st1'], [-123, 'c9', 'p11', 'cat-gentle-cat-bath', '12:00', 'st2'],
];

export function seedBookings(customers: StoredCustomer[], now = new Date()): Booking[] {
  const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000).toISOString();
  const history: SeedBooking[] = HISTORY.map(([day, customer, pet, service, time, station], i) => ({
    id: `PP-${1000 + i}`, customer, pet, service, stage: 'completed', payment: 'paid', createdMinutesAgo: (-day + 2) * 24 * 60,
    day, time, station, amountType: 'full', sentMinutesAgo: (-day + 2) * 24 * 60 - 30, source: 'app',
  }));

  return [...SEED_BOOKINGS, ...history].map(s => {
    const customer = customers.find(c => c.id === s.customer)!;
    const pet = customer.pets.find(p => p.id === s.pet)!;
    const service = SERVICES.find(sv => sv.id === s.service);
    const price = service ? discounted(service.pricePaise, seedDiscount(customer.id)) : null;
    const date = s.day === undefined ? null : addDays(today(), s.day);
    const createdAt = minutesAgo(s.createdMinutesAgo);
    const source = s.source ?? 'app';
    const activity: ActivityEntry[] = [];

    if (s.request) {
      activity.push({ at: createdAt, kind: 'request', title: source === 'app' ? 'Callback requested in the app' : 'Request taken by phone', detail: s.request.message });
      if (s.request.callOutcome) activity.push({ at: minutesAgo(s.createdMinutesAgo - 10), kind: 'call', title: `Call outcome: ${s.request.callOutcome.replace(/_/g, ' ')}`, by: 'Meera K.' });
    } else {
      activity.push({ at: createdAt, kind: 'request', title: source === 'app' ? 'Booked in the app' : 'Booking started by phone', by: source === 'app' ? undefined : 'Meera K.' });
    }

    let payment: Booking['payment'] = null;
    if (s.sentMinutesAgo !== undefined && price !== null && date && s.time) {
      const sentAt = minutesAgo(s.sentMinutesAgo);
      const amountPaise = s.amountType === 'hold' ? Math.min(SETTINGS.payments.slotHoldPaise, price) : price;
      const paid = s.payment === 'paid' || s.payment === 'refunded';
      payment = {
        amountType: s.amountType ?? 'full',
        amountPaise,
        link: `https://pay.poshpaws.in/l/${s.id}`,
        sentAt,
        expiresAt: new Date(new Date(sentAt).getTime() + 24 * 3_600_000).toISOString(),
        ...(paid && { paidAt: minutesAgo(Math.max(0, s.sentMinutesAgo - 20)), method: 'online' as const }),
      };
      activity.push({ at: minutesAgo(s.sentMinutesAgo + 2), kind: 'details', title: 'Booking details saved', detail: `${service!.name} · ${date} ${s.time}` });
      activity.push({ at: sentAt, kind: 'payment', title: source === 'app' ? 'Paid in the app' : 'Payment link sent on WhatsApp', by: source === 'app' ? undefined : 'Meera K.' });
      if (s.payment === 'failed') activity.push({ at: minutesAgo(20), kind: 'payment', title: 'Payment failed', detail: 'The bank declined the payment.' });
      if (paid && source !== 'app') activity.push({ at: payment.paidAt!, kind: 'payment', title: 'Paid online', detail: 'Booking confirmed automatically.' });
    }
    if (s.stage === 'completed' && date && s.time) activity.push({ at: slotStart(date, s.time).toISOString(), kind: 'status', title: 'Marked completed', by: 'Amit J.' });
    if (s.stage === 'no_show' && date && s.time) activity.push({ at: slotStart(date, s.time).toISOString(), kind: 'status', title: 'Marked as no-show', by: 'Amit J.' });
    if (s.stage === 'cancelled') activity.push({ at: minutesAgo(60 * 24 * 4), kind: 'status', title: 'Booking cancelled', detail: 'Customer travelling. Refunded in full.', by: 'Sanjay R.' });

    return {
      id: s.id,
      createdAt,
      source,
      stage: s.stage,
      paymentStatus: s.payment ?? 'not_requested',
      customer: { id: customer.id, name: customer.name, phone: customer.phone },
      pet: { id: pet.id, name: pet.name, type: pet.type, breed: pet.breed },
      service: service ? { id: service.id, name: service.name, durationMinutes: service.durationMinutes } : null,
      date,
      time: s.time ?? null,
      stationId: s.station ?? null,
      pricePaise: price,
      payment,
      request: s.request,
      bookedBy: source === 'app' ? undefined : 'Meera K.',
      activity: activity.sort((a, b) => b.at.localeCompare(a.at)),
    } satisfies Booking;
  });
}

interface SeedSubscription {
  id: string;
  customer: string;
  plan: 'basic' | 'posh' | 'royal';
  startedDaysAgo: number;
  status: SubscriptionStatus;
  used: number;
  /** Active: renews in this many days. */
  renewsInDays?: number;
  /** Expired / cancelled: ended this many days ago. */
  endedDaysAgo?: number;
}

const SEED_SUBSCRIPTIONS: SeedSubscription[] = [
  { id: 'SUB-101', customer: 'c1', plan: 'posh', startedDaysAgo: 970, status: 'active', used: 2, renewsInDays: 4 },
  { id: 'SUB-102', customer: 'c2', plan: 'royal', startedDaysAgo: 650, status: 'active', used: 3, renewsInDays: 12 },
  { id: 'SUB-103', customer: 'c6', plan: 'posh', startedDaysAgo: 480, status: 'active', used: 4, renewsInDays: 1 },
  { id: 'SUB-104', customer: 'c5', plan: 'basic', startedDaysAgo: 435, status: 'active', used: 1, renewsInDays: 20 },
  { id: 'SUB-105', customer: 'c13', plan: 'basic', startedDaysAgo: 700, status: 'active', used: 0, renewsInDays: 11 },
  { id: 'SUB-106', customer: 'c15', plan: 'posh', startedDaysAgo: 690, status: 'active', used: 1, renewsInDays: 9 },
  { id: 'SUB-107', customer: 'c11', plan: 'posh', startedDaysAgo: 270, status: 'active', used: 5, renewsInDays: 2 },
  { id: 'SUB-108', customer: 'c8', plan: 'basic', startedDaysAgo: 6, status: 'payment_pending', used: 0 },
  { id: 'SUB-109', customer: 'c10', plan: 'royal', startedDaysAgo: 540, status: 'expired', used: 0, endedDaysAgo: 22 },
  { id: 'SUB-110', customer: 'c12', plan: 'basic', startedDaysAgo: 210, status: 'cancelled', used: 0, endedDaysAgo: 16 },
];

/** Member discount at seed time (bookings copy the price they were made at). */
function seedDiscount(customerId: string): number {
  const sub = SEED_SUBSCRIPTIONS.find(s => s.customer === customerId && s.status === 'active');
  return sub ? PLANS.find(p => p.id === sub.plan)!.discountPercent : 0;
}

export function seedSubscriptions(customers: StoredCustomer[]): Subscription[] {
  const t = today();
  return SEED_SUBSCRIPTIONS.map(s => {
    const customer = customers.find(c => c.id === s.customer)!;
    const plan = PLANS.find(p => p.id === s.plan)!;
    return {
      id: s.id,
      customer: { id: customer.id, name: customer.name, phone: customer.phone },
      planId: plan.id,
      planName: plan.name,
      pricePaise: plan.pricePaise,
      sessionsTotal: plan.sessionsPerPeriod,
      sessionsUsed: s.used,
      startedOn: addDays(t, -s.startedDaysAgo),
      renewsOn: s.renewsInDays === undefined ? null : addDays(t, s.renewsInDays),
      endedOn: s.endedDaysAgo === undefined ? null : addDays(t, -s.endedDaysAgo),
      status: s.status,
      paymentLink: s.status === 'payment_pending' ? { link: `https://pay.poshpaws.in/s/${s.id}`, sentAt: daysAgoIso(6) } : null,
    };
  });
}

/** Offers seed (Catalog › Offers), from the design. Dates are relative to today. */
export function seedOffers(): Offer[] {
  const t = today();
  const offer = (o: Omit<Offer, 'status' | 'serviceIds' | 'perCustomer' | 'newCustomersOnly' | 'draft' | 'paused'> & Partial<Offer>): Offer =>
    ({ serviceIds: [], perCustomer: 1, newCustomersOnly: false, draft: false, paused: false, status: 'live', ...o });
  return [
    offer({ id: 'off-1', title: 'Diwali grooming week', discountType: 'percent', value: 20, code: 'DIWALI20', appliesTo: 'some_services',
      serviceIds: ['dog-signature-bath', 'dog-full-groom-style', 'dog-royal-package', 'dog-de-shedding-treatment', 'dog-flea-tick-spa', 'dog-nail-trim-filing'],
      startsOn: addDays(t, -20), endsOn: addDays(t, 2), totalUses: 150, used: 84 }),
    offer({ id: 'off-2', title: 'Refer a friend', discountType: 'flat', value: 20000, code: null, appliesTo: 'all_services',
      startsOn: addDays(t, -200), endsOn: null, totalUses: null, perCustomer: null, used: 31 }),
    offer({ id: 'off-3', title: 'First groom, 15% off', discountType: 'percent', value: 15, code: 'FIRSTPAW15', appliesTo: 'all_services',
      startsOn: addDays(t, 1), endsOn: addDays(t, 30), totalUses: 200, newCustomersOnly: true, used: 0 }),
    offer({ id: 'off-4', title: 'Cat care month', discountType: 'percent', value: 10, code: 'MEOW10', appliesTo: 'some_services',
      serviceIds: ['cat-gentle-cat-bath', 'cat-full-groom-trim', 'cat-nail-trim-filing', 'cat-de-shedding-treatment', 'cat-royale-cat-package', 'cat-flea-tick-spa'],
      startsOn: addDays(t, -60), endsOn: addDays(t, -31), totalUses: 100, used: 57 }),
    offer({ id: 'off-5', title: 'Royal plan, first month', discountType: 'flat', value: 50000, code: 'ROYAL500', appliesTo: 'plans',
      startsOn: addDays(t, -30), endsOn: addDays(t, 30), totalUses: 50, used: 12, paused: true }),
  ];
}

// ── Content (Banners, Gallery, Pages & FAQs) ────────────────

const PAW = 'M12 14c-2.5 0-5 2-5 4.5 0 1.7 1.3 2.5 2.7 2.5 1 0 1.5-.5 2.3-.5s1.3.5 2.3.5c1.4 0 2.7-.8 2.7-2.5 0-2.5-2.5-4.5-5-4.5zM5.5 11a1.8 2.2 0 1 0 0-4.4 1.8 2.2 0 0 0 0 4.4zM9.5 7a1.8 2.2 0 1 0 0-4.4 1.8 2.2 0 0 0 0 4.4zM14.5 7a1.8 2.2 0 1 0 0-4.4 1.8 2.2 0 0 0 0 4.4zM18.5 11a1.8 2.2 0 1 0 0-4.4 1.8 2.2 0 0 0 0 4.4z';

/** A small coloured stand-in image (SVG) for seeded photos and banners. */
function placeholderImage(color: string, width = 1200, height = 900): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="${color}"/>`
    + `<g transform="translate(${width / 2 - 60} ${height / 2 - 60}) scale(5)" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="1.4"><path d="${PAW}"/></g></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** Banners seed, from the design. Dates are relative to today. */
export function seedBanners(): StoredBanner[] {
  const t = today();
  const banner = (id: string, placement: StoredBanner['placement'], title: string, subtitle: string, buttonText: string, link: StoredBanner['link'],
    startsOn: string, endsOn: string | null, color: string, paused = false): StoredBanner =>
    ({ id, placement, title, subtitle, buttonText, link, startsOn, endsOn, paused,
      imageUrl: placeholderImage(color, 1080, 1350), desktopImageUrl: placeholderImage(color, 1920, 720) });
  return [
    banner('ban-1', 'home_hero', 'Diwali grooming week', '20% off every dog service, with the code DIWALI20.', 'Book with 20% off', 'book', addDays(t, -20), addDays(t, 2), '#2D6A4F'),
    banner('ban-2', 'home_hero', 'Winter coat care', 'De-shedding and deep conditioning for thick winter coats.', 'See treatments', 'services', addDays(t, 3), addDays(t, 33), '#5C4A33'),
    banner('ban-3', 'home_hero', 'Monsoon paw care', 'Paw cleaning and anti-fungal care after rainy walks.', 'Book now', 'book', addDays(t, -60), addDays(t, -31), '#C4B49E'),
    banner('ban-4', 'home_promo', 'Refer a friend, get ₹200', 'Your friend gets ₹200 off their first groom too.', 'Book now', 'book', addDays(t, -200), null, '#F4A261'),
    banner('ban-5', 'services', 'New: De-shedding Treatment', 'Less shedding at home after one session.', 'See it', 'services', addDays(t, -15), addDays(t, 15), '#2D6A4F'),
    banner('ban-6', 'membership', 'Royal plan, ₹500 off the first month', 'Unlimited grooming for less this month.', 'See plans', 'membership', addDays(t, -30), addDays(t, 30), '#8A3F0E', true),
  ];
}

export const GALLERY_CATEGORIES: StoredCategory[] = [
  { id: 'gc-grooming', name: 'Grooming' },
  { id: 'gc-before-after', name: 'Before & after' },
  { id: 'gc-happy', name: 'Happy pets' },
  { id: 'gc-studio', name: 'Studio' },
  { id: 'gc-events', name: 'Events' },
];

export function seedGallery(): GalleryPhoto[] {
  const photos: [caption: string, categoryId: string, pet: string, color: string, visible: boolean][] = [
    ['Bruno after his Royal Package', 'gc-happy', 'Golden Retriever', '#C9A26B', true],
    ['Luna, freshly brushed', 'gc-grooming', 'Persian', '#B8A99A', true],
    ['Before and after: Rocky', 'gc-before-after', 'German Shepherd', '#7E6B55', true],
    ['Coco ready for Diwali', 'gc-happy', 'Shih Tzu', '#D9B38C', false],
    ['Our grooming room', 'gc-studio', '', '#5F7F6C', true],
    ['Mia at the flea spa', 'gc-grooming', 'Siamese', '#A89580', true],
    ['Adoption day, September', 'gc-events', '', '#3F6E57', true],
    ['Before and after: Tiger', 'gc-before-after', 'Indie', '#8C7356', false],
    ['Pumpkin after a cat bath', 'gc-grooming', 'Ragdoll', '#C2B3A3', true],
    ['Daisy loves the dryer', 'gc-happy', 'Beagle', '#B48A5E', true],
  ];
  return photos.map(([caption, categoryId, pet, color, visible], i) => ({ id: `ph-${i + 1}`, imageUrl: placeholderImage(color), caption, categoryId, pet, visible }));
}

/** The words on the customer app's pages, from the customer app as it is today. */
export function seedPages(): SitePage[] {
  const section = (id: string, kind: string, heading: string, body: string, visible = true): PageSection => ({ id, kind, heading, body, visible, fixed: true });
  const story = 'Posh Paws was born from a simple belief: every pet deserves the same quality of care their owner gives themselves. We started in a small studio in Koregaon Park and have grown into Pune’s most trusted grooming sanctuary, one happy pet at a time.\n\n'
    + 'Our groomers are certified professionals who genuinely love animals. We use only imported, pet-safe, sulphate-free products: nothing harsh, nothing that doesn’t belong near your companion.';
  const values = 'Only safe products. Imported, organic, sulphate-free formulas.\n\nCertified groomers. Every groomer on our team is trained, certified and passionate about animal welfare.\n\n'
    + 'Fear-free approach. We move at your pet’s pace. Calm handling, gentle techniques, no rush.\n\nHonest pricing. No hidden fees, no surprise add-ons.';
  const about = [
    section('about-intro', 'Our story', 'Six years of caring for Pune’s pets', story),
    section('about-values', 'Values', 'The values behind every session', values),
    section('about-team', 'Team', 'Meet the groomers', '[Your groomers’ names]', false),
  ];
  const published = { publishedAt: daysAgoIso(9), publishedBy: 'Meera K.', draft: null, draftSavedAt: null, draftSavedBy: null };
  return [
    {
      key: 'home', title: 'Home page', ...published, sections: [
        section('home-hero', 'Hero (the image comes from Banners)', 'Your pet deserves only the finest.', 'Premium grooming rituals crafted with love, for cats and dogs. By appointment, because your pet’s time matters too.'),
        section('home-services', 'Services (cards come from Services)', 'Grooming rituals for every pet', ''),
        section('home-plans', 'Membership (cards come from Membership plans)', 'Choose your plan', ''),
        section('home-story', 'Our story', 'Six years of caring for Pune’s pets', story),
        section('home-gallery', 'Gallery (photos come from Gallery)', 'Happy pets, every time', ''),
        section('home-reviews', 'Testimonials', 'What pet parents say', ''),
      ],
    },
    {
      key: 'about', title: 'About', ...published, sections: about,
      draft: about.map(s => (s.id === 'about-team' ? { ...s, visible: true, body: 'Our certified groomers: [names]. Ask for your favourite when you book.' } : s)),
      draftSavedAt: daysAgoIso(1), draftSavedBy: 'Meera K.',
    },
    { key: 'terms', title: 'Terms of service', ...published, sections: [section('terms-body', 'Body', 'Terms of service', '[Your terms of service]')] },
    { key: 'privacy', title: 'Privacy policy', ...published, sections: [section('privacy-body', 'Body', 'Privacy policy', '[Your privacy policy]')] },
  ];
}

export const FAQ_GROUPS: FaqGroup[] = [
  { id: 'fg-booking', name: 'Booking', shownOn: 'Services, Booking' },
  { id: 'fg-membership', name: 'Membership', shownOn: 'Membership' },
  { id: 'fg-pets', name: 'Pets and safety', shownOn: 'About, Services' },
];

/** FAQs seed: the Membership answers are the customer app's own. */
export const FAQS: Faq[] = [
  { id: 'faq-1', groupId: 'fg-booking', question: 'How do I book a slot?', answer: 'Tap Book now, pick a service, a time and your pet, then confirm with a ₹100 hold. We send the confirmation on WhatsApp.' },
  { id: 'faq-2', groupId: 'fg-booking', question: 'Can I reschedule?', answer: 'Yes, up to 24 hours before your slot at no charge.' },
  { id: 'faq-3', groupId: 'fg-booking', question: 'How does the ₹100 hold work?', answer: 'It secures your slot and is adjusted in your bill when you arrive.' },
  { id: 'faq-4', groupId: 'fg-membership', question: 'Can I cancel or change my plan anytime?', answer: 'Yes. You can upgrade, downgrade, or cancel your membership at any time before the next billing cycle. No lock-in, no penalties.' },
  { id: 'faq-5', groupId: 'fg-membership', question: 'Do unused sessions roll over to the next month?', answer: 'Sessions are valid for the calendar month. They do not roll over, so we recommend booking early to make the most of your plan.' },
  { id: 'faq-6', groupId: 'fg-membership', question: 'Can I use my membership for both dogs and cats?', answer: 'Absolutely. Your membership covers all pets linked to your profile. Add multiple pets and the sessions are shared across them.' },
  { id: 'faq-7', groupId: 'fg-membership', question: 'How does the ₹100 slot hold work for members?', answer: 'Members still place a ₹100 refundable hold to confirm a booking. It is fully returned when you arrive for the appointment.' },
  { id: 'faq-8', groupId: 'fg-pets', question: 'Is my pet safe with anxious handling?', answer: 'We follow a fear-free approach and move at your pet’s pace.' },
  { id: 'faq-9', groupId: 'fg-pets', question: 'Do you need vaccination records?', answer: 'Yes, please share them before the first visit.' },
];

// ── Business (Payments, Message templates, Settings) ──────────

/** Closures seed, relative to today. Stored without the worked-out booking count. */
export function seedClosures(): Omit<Settings['booking']['closures'][number], 'affectedBookings'>[] {
  const t = today();
  const year = Number(t.slice(0, 4)) + (t.slice(5) > '12-25' ? 1 : 0);
  return [
    { id: 'cl-1', date: addDays(t, 12), name: 'Festival holiday', closesAt: null },
    { id: 'cl-2', date: `${year}-12-25`, name: 'Christmas', closesAt: null },
    { id: 'cl-3', date: `${year + 1}-01-01`, name: 'New Year’s Day', closesAt: '14:00' },
  ];
}

export function seedTeam(): TeamMember[] {
  const lastSeen = [daysAgoIso(2), new Date().toISOString(), daysAgoIso(1)];
  return [
    ...STAFF.map((s, i) => ({ ...s, status: 'active' as const, lastSeenAt: lastSeen[i] })),
    { id: 'st-4', name: 'Pooja S.', email: 'pooja@poshpaws.in', role: 'staff', status: 'invited', lastSeenAt: null },
  ];
}

/** Message templates seed: the payment, plan and win-back texts are the ones staff have been sending. */
export function seedTemplates(): Omit<MessageTemplate, 'trigger'>[] {
  const at = daysAgoIso(12);
  const t = (key: TemplateKey, group: MessageTemplate['group'], name: string, body: string, canAutoSend: boolean, approval: MessageTemplate['approval'] = 'approved') =>
    ({ key, group, name, body, canAutoSend, autoSend: canAutoSend && approval === 'approved', approval, updatedAt: at, updatedBy: 'Meera K.' });
  return [
    t('payment_link', 'Bookings', 'Payment link', 'Hi {customer_name}, {pet_name}\'s grooming at Posh Paws is almost booked.\n{service} · {date_time}\nPay {amount} here to confirm: {payment_link}\nThe link works for {link_hours} hours. Reply here if you need to change anything.', false),
    t('booking_confirmed', 'Bookings', 'Booking confirmed', 'Thank you, {customer_name}! {pet_name} is booked for {service} on {date_time}. We\'ll remind you the evening before. Reply here to reschedule.', true),
    t('booking_reminder', 'Bookings', 'Reminder the day before', 'See you tomorrow, {customer_name}! {pet_name}\'s {service} is at {date_time}. Please arrive 10 minutes early.', true),
    t('unpaid_nudge', 'Bookings', 'Unpaid link nudge', 'Hi {customer_name}, we\'re still holding {date_time} for {pet_name}. Pay {amount} to keep it: {payment_link}', true, 'pending'),
    t('callback_received', 'Requests', 'Callback received', 'Hi {customer_name}, thanks for reaching out to Posh Paws! We\'ll call you back shortly about {pet_name}.', true),
    t('missed_call', 'Requests', 'Missed call follow-up', 'Hi {customer_name}, we tried calling about {pet_name}\'s grooming. Reply with a good time and we\'ll call back.', false),
    t('plan_payment', 'Membership', 'First plan payment', 'Hi {customer_name}, welcome to the {plan} plan at Posh Paws!\nPay {amount} here to start your membership: {payment_link}\nReply here if you have any questions.', false),
    t('plan_renewal', 'Membership', 'Renewal reminder', 'Hi {customer_name}, your {plan} plan at Posh Paws renews on {renewal_date}.\nPay {amount} here to keep your sessions and member prices: {payment_link}\nReply here if you have any questions.', true),
    t('plan_welcome', 'Membership', 'Welcome to a plan', 'Welcome to the {plan} plan, {customer_name}! Your sessions are ready to book.', true, 'draft'),
    t('win_back', 'Membership', 'Win back', 'Hi {customer_name}, we miss you at Posh Paws!\nYour {plan} plan has ended. Reply here and we\'ll restart it, or book a visit any time.', false),
  ];
}
