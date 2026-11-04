import { Paise, PetType } from './catalog.model';

/** Where the booking is in its life (design: "two simple tracks"). */
export type BookingStage = 'draft' | 'awaiting_payment' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
/** Worked out by the server from the bill, the payments and any open link (see "Booking & payment rules" in the root CLAUDE.md). */
export type PaymentStatus = 'unpaid' | 'link_sent' | 'failed' | 'part_paid' | 'paid' | 'refunded';
export type BookingSource = 'app' | 'phone' | 'walk_in';
/** What a payment link asks for: the advance (slot hold) or everything still due. */
export type AmountType = 'full' | 'hold';
/** `online` = through a payment link or the app; the rest are taken at the shop. */
export type PaymentMethod = 'online' | 'upi_qr' | 'cash' | 'card';

/** An open payment link. Cleared once it's paid. */
export interface PaymentLink {
  amountType: AmountType;
  amountPaise: Paise;
  url: string;
  /** ISO timestamps */
  sentAt: string;
  expiresAt: string;
  /** The customer's bank declined it. */
  failed?: boolean;
}

/** Money received for a booking, or given back. Amounts are positive; `refund` entries are subtracted. */
export interface PaymentEntry {
  /** e.g. PAY-1051-1 */
  id: string;
  kind: 'advance' | 'balance' | 'refund';
  amountPaise: Paise;
  method: PaymentMethod;
  /** ISO timestamp */
  at: string;
  /** Staff who took or refunded it at the shop. */
  by?: string;
  /** For a refund: the entry it gives back. */
  refundOf?: string;
}

/** The one discount on a bill (they don't stack; the best wins). */
export interface BillDiscount {
  kind: 'session' | 'membership' | 'offer';
  /** e.g. "Posh plan session", "Posh member 10% off", "DIWALI20 · Diwali grooming week". */
  label: string;
  amountPaise: Paise;
  offerId?: string;
}

/** What the booking costs and what's been paid. The server works it out; both apps show it as is. */
export interface BookingBill {
  servicePricePaise: Paise;
  discount: BillDiscount | null;
  totalPaise: Paise;
  /** Asked for online when booked in the app; 0 for phone bookings. */
  advancePaise: Paise;
  /** Payments minus refunds. */
  paidPaise: Paise;
  /** total − paid, never below 0. */
  balancePaise: Paise;
}

export interface ActivityEntry {
  /** ISO timestamp */
  at: string;
  title: string;
  detail?: string;
  /** Staff name, when a person did it. */
  by?: string;
  kind: 'created' | 'details' | 'payment' | 'status' | 'note';
}

/** One booking from first booked (in the app, or by staff on a phone call) to finished groom. Customer, pet and service are snapshots. */
export interface Booking {
  /** e.g. PP-1051 */
  id: string;
  createdAt: string;
  source: BookingSource;
  stage: BookingStage;
  paymentStatus: PaymentStatus;
  customer: { id: string; name: string; phone: string };
  pet: { id: string; name: string; type: PetType; breed?: string } | null;
  service: { id: string; name: string; durationMinutes: number } | null;
  /** YYYY-MM-DD, HH:mm; null until a slot is picked. */
  date: string | null;
  time: string | null;
  stationId: string | null;
  /** Null until a service is picked. Prices are fixed when the booking is confirmed. */
  bill: BookingBill | null;
  payments: PaymentEntry[];
  paymentLink: PaymentLink | null;
  /** Offer code typed for this booking, if any. */
  offerCode?: string | null;
  bookedBy?: string;
  activity: ActivityEntry[];
}

/** Body of POST /admin/bookings (new) and PUT /admin/bookings/{id} (a draft). Saves a draft. */
export interface BookingDetails {
  customerId: string;
  petId: string;
  serviceId: string;
  date: string | null;
  time: string | null;
  /** Offer code the customer gave; the server checks it. */
  offerCode?: string | null;
}

/** POST /admin/bookings/quote: the bill a booking would have, without saving anything. */
export interface QuoteRequest {
  customerId: string;
  serviceId: string;
  offerCode?: string | null;
}

/** POST /admin/bookings/{id}/payments: money taken at the shop. */
export interface NewShopPayment {
  amountPaise: Paise;
  method: Exclude<PaymentMethod, 'online'>;
  /** Checkout: also mark the visit completed (only once the appointment has started). */
  complete?: boolean;
}

/** GET /admin/bookings filters. Empty fields mean "any". */
export interface BookingFilters {
  stages?: BookingStage[];
  customerId?: string;
  range?: 'any' | 'today' | 'next7' | 'last30';
  serviceId?: string;
  petType?: PetType;
  paymentStatus?: PaymentStatus;
  page?: number;
  pageSize?: number;
}

/** GET /admin/bookings/counts: how many bookings sit in each stage. */
export type StageCounts = Record<BookingStage, number>;
