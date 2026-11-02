import { Paise } from './catalog.model';
import { PetType } from './pet.model';

export type BookingStatus = 'confirmed' | 'completed' | 'cancelled' | 'no_show';

/** Worked out by the server from the money (root CLAUDE.md › Booking & payment rules). */
export type PaymentStatus = 'unpaid' | 'link_sent' | 'failed' | 'part_paid' | 'paid' | 'refunded';

/** At most one discount per booking: a plan session, the member discount or an offer, whichever is best. */
export interface BillDiscount {
  kind: 'session' | 'membership' | 'offer';
  label: string;
  amountPaise: Paise;
}

/** The bill, worked out by the server. Same shape in the admin app. */
export interface BookingBill {
  servicePricePaise: Paise;
  discount: BillDiscount | null;
  totalPaise: Paise;
  /** Paid online to confirm an app booking; counts toward the total. */
  advancePaise: Paise;
  /** Payments minus refunds. */
  paidPaise: Paise;
  /** Still to pay at the shop (shop UPI QR, cash or card). */
  balancePaise: Paise;
}

export interface PaymentEntry {
  id: string;
  kind: 'advance' | 'balance' | 'refund';
  amountPaise: Paise;
  method: 'online' | 'upi_qr' | 'cash' | 'card';
  at: string;
}

/** An appointment as the API returns it. Service and pet details are copied in when booked. */
export interface Booking {
  id: string;
  serviceId: string;
  serviceName: string;
  serviceIcon: string;
  petId: string;
  petName: string;
  petType: PetType;
  /** YYYY-MM-DD */
  date: string;
  /** HH:mm (24h) */
  time: string;
  durationMinutes: number;
  bill: BookingBill;
  payments: PaymentEntry[];
  paymentStatus: PaymentStatus;
  offerCode?: string | null;
  notes?: string;
  status: BookingStatus;
  createdAt: string;
}

/** Body of POST /bookings. The server works out the bill, takes the advance and confirms it. */
export interface BookingRequest {
  serviceId: string;
  petId: string;
  date: string;
  time: string;
  notes?: string;
  offerCode?: string;
}

/** Body of POST /bookings/quote: the bill before booking (needs login, as plans and offers depend on the customer). */
export interface QuoteRequest {
  serviceId: string;
  offerCode?: string;
}

/** One start time from GET /slots. */
export interface TimeSlot {
  /** HH:mm (24h) */
  time: string;
  available: boolean;
}
