import { Paise, PetType } from './catalog.model';

/** Where the booking is in its life (design: "two simple tracks"). */
export type BookingStage = 'request' | 'draft' | 'awaiting_payment' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
export type PaymentStatus = 'not_requested' | 'link_sent' | 'paid' | 'failed' | 'refunded';
export type BookingSource = 'app' | 'phone' | 'walk_in';
export type CallOutcome = 'reached' | 'no_answer' | 'call_back_later';
/** Full price now, or the refundable slot hold with the balance at the visit. */
export type AmountType = 'full' | 'hold';

/** What the customer asked for in a callback request. */
export interface RequestInfo {
  /** Free text from the request form when the pet isn't on file. */
  petNote?: string;
  interestedIn?: string;
  bestTime?: string;
  message?: string;
  callOutcome?: CallOutcome;
}

export interface BookingPayment {
  amountType: AmountType;
  amountPaise: Paise;
  link: string;
  /** ISO timestamps */
  sentAt: string;
  expiresAt: string;
  paidAt?: string;
  /** 'online' when paid through the link, 'desk' when marked at the salon. */
  method?: 'online' | 'desk';
  refundedAt?: string;
}

export interface ActivityEntry {
  /** ISO timestamp */
  at: string;
  title: string;
  detail?: string;
  /** Staff name, when a person did it. */
  by?: string;
  kind: 'request' | 'call' | 'details' | 'payment' | 'status' | 'note';
}

/** One booking from first request to finished groom. Customer, pet and service are snapshots. */
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
  /** Service price after any member discount. */
  pricePaise: Paise | null;
  payment: BookingPayment | null;
  request?: RequestInfo;
  bookedBy?: string;
  activity: ActivityEntry[];
}

/** Body of POST /admin/bookings (new) and PUT /admin/bookings/{id} (request or draft). Saves a draft. */
export interface BookingDetails {
  customerId: string;
  petId: string;
  serviceId: string;
  date: string | null;
  time: string | null;
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
