import { SLOT_HOLD_PAISE } from '../constants/app.constants';
import { ActivityEntry, AmountType, Booking, BookingSource, BookingStage, PaymentStatus, RequestInfo } from '../models/booking.model';
import { Service, Station } from '../models/catalog.model';
import { CustomerPet, StaffNote } from '../models/customer.model';
import { Subscription, SubscriptionStatus } from '../models/subscription.model';
import { StaffUser } from '../models/staff-user.model';
import { addDays, slotStart, today } from '../utils/date.utils';
import type { StoredCustomer } from './mock-db';
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

/** Same catalog as the customer app. */
export const SERVICES: Service[] = [
  { id: 'dog-signature-bath', petType: 'dog', name: 'Signature Bath', pricePaise: 120000, durationMinutes: 45, active: true },
  { id: 'dog-full-groom-style', petType: 'dog', name: 'Full Groom & Style', pricePaise: 250000, durationMinutes: 90, active: true },
  { id: 'dog-royal-package', petType: 'dog', name: 'Royal Package', pricePaise: 450000, durationMinutes: 150, active: true },
  { id: 'dog-nail-trim-filing', petType: 'dog', name: 'Nail Trim & Filing', pricePaise: 40000, durationMinutes: 20, active: true },
  { id: 'dog-de-shedding-treatment', petType: 'dog', name: 'De-shedding Treatment', pricePaise: 180000, durationMinutes: 60, active: true },
  { id: 'dog-flea-tick-spa', petType: 'dog', name: 'Flea & Tick Spa', pricePaise: 150000, durationMinutes: 60, active: true },
  { id: 'cat-gentle-cat-bath', petType: 'cat', name: 'Gentle Cat Bath', pricePaise: 90000, durationMinutes: 40, active: true },
  { id: 'cat-full-groom-trim', petType: 'cat', name: 'Full Groom & Trim', pricePaise: 200000, durationMinutes: 75, active: true },
  { id: 'cat-nail-trim-filing', petType: 'cat', name: 'Nail Trim & Filing', pricePaise: 35000, durationMinutes: 15, active: true },
  { id: 'cat-de-shedding-treatment', petType: 'cat', name: 'De-shedding Treatment', pricePaise: 140000, durationMinutes: 50, active: true },
  { id: 'cat-royale-cat-package', petType: 'cat', name: 'Royale Cat Package', pricePaise: 350000, durationMinutes: 120, active: true },
  { id: 'cat-flea-tick-spa', petType: 'cat', name: 'Flea & Tick Spa', pricePaise: 120000, durationMinutes: 50, active: true },
];

export const STATIONS: Station[] = [
  { id: 'st1', name: 'Station 1' },
  { id: 'st2', name: 'Station 2' },
];

/** Booking rules (Settings › Booking & availability in Phase F). */
export const HOURS = {
  opens: '09:00',
  closes: '19:00',
  /** Start times are offered every this many minutes. */
  step: 30,
  /** Cleaning time kept free after every appointment. */
  bufferMinutes: 15,
  lunch: { time: '14:00', durationMinutes: 30 },
};

/** Membership plans (Catalog › Membership plans in Phase D). sessions null = unlimited. */
export const PLAN_CATALOG: Record<string, { pricePaise: number; sessions: number | null; discountPercent: number }> = {
  Basic: { pricePaise: 49900, sessions: 2, discountPercent: 0 },
  Posh: { pricePaise: 99900, sessions: 5, discountPercent: 10 },
  Royal: { pricePaise: 199900, sessions: null, discountPercent: 20 },
};

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
      const amountPaise = s.amountType === 'hold' ? Math.min(SLOT_HOLD_PAISE, price) : price;
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
  plan: keyof typeof PLAN_CATALOG;
  startedDaysAgo: number;
  status: SubscriptionStatus;
  used: number;
  /** Active: renews in this many days. */
  renewsInDays?: number;
  /** Expired / cancelled: ended this many days ago. */
  endedDaysAgo?: number;
}

const SEED_SUBSCRIPTIONS: SeedSubscription[] = [
  { id: 'SUB-101', customer: 'c1', plan: 'Posh', startedDaysAgo: 970, status: 'active', used: 2, renewsInDays: 4 },
  { id: 'SUB-102', customer: 'c2', plan: 'Royal', startedDaysAgo: 650, status: 'active', used: 3, renewsInDays: 12 },
  { id: 'SUB-103', customer: 'c6', plan: 'Posh', startedDaysAgo: 480, status: 'active', used: 4, renewsInDays: 1 },
  { id: 'SUB-104', customer: 'c5', plan: 'Basic', startedDaysAgo: 435, status: 'active', used: 1, renewsInDays: 20 },
  { id: 'SUB-105', customer: 'c13', plan: 'Basic', startedDaysAgo: 700, status: 'active', used: 0, renewsInDays: 11 },
  { id: 'SUB-106', customer: 'c15', plan: 'Posh', startedDaysAgo: 690, status: 'active', used: 1, renewsInDays: 9 },
  { id: 'SUB-107', customer: 'c11', plan: 'Posh', startedDaysAgo: 270, status: 'active', used: 5, renewsInDays: 2 },
  { id: 'SUB-108', customer: 'c8', plan: 'Basic', startedDaysAgo: 6, status: 'payment_pending', used: 0 },
  { id: 'SUB-109', customer: 'c10', plan: 'Royal', startedDaysAgo: 540, status: 'expired', used: 0, endedDaysAgo: 22 },
  { id: 'SUB-110', customer: 'c12', plan: 'Basic', startedDaysAgo: 210, status: 'cancelled', used: 0, endedDaysAgo: 16 },
];

/** Member discount at seed time (bookings copy the price they were made at). */
function seedDiscount(customerId: string): number {
  const sub = SEED_SUBSCRIPTIONS.find(s => s.customer === customerId && s.status === 'active');
  return sub ? PLAN_CATALOG[sub.plan].discountPercent : 0;
}

export function seedSubscriptions(customers: StoredCustomer[]): Subscription[] {
  const t = today();
  return SEED_SUBSCRIPTIONS.map(s => {
    const customer = customers.find(c => c.id === s.customer)!;
    const plan = PLAN_CATALOG[s.plan];
    return {
      id: s.id,
      customer: { id: customer.id, name: customer.name, phone: customer.phone },
      planName: s.plan,
      pricePaise: plan.pricePaise,
      sessionsTotal: plan.sessions,
      sessionsUsed: s.used,
      startedOn: addDays(t, -s.startedDaysAgo),
      renewsOn: s.renewsInDays === undefined ? null : addDays(t, s.renewsInDays),
      endedOn: s.endedDaysAgo === undefined ? null : addDays(t, -s.endedDaysAgo),
      status: s.status,
      paymentLink: s.status === 'payment_pending' ? { link: `https://pay.poshpaws.in/s/${s.id}`, sentAt: daysAgoIso(6) } : null,
    };
  });
}

/** Dashboard card for a screen built in a later phase (content: Phase E). */
export const DASHBOARD_LATER = {
  content: [
    { title: 'Diwali offer', where: 'Home hero banner', status: 'Ends in 2 days', tone: 'warn' as const },
    { title: 'Membership promo', where: 'Membership page banner', status: 'Live', tone: 'success' as const },
    { title: '3 new photos', where: 'Gallery', status: 'Draft', tone: 'draft' as const },
    { title: 'FAQs', where: 'Pages & FAQs · edited 5 days ago', status: 'Live', tone: 'success' as const },
  ],
};
