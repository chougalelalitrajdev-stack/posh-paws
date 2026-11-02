import { Paise } from './catalog.model';

/** A payment link and what happened to it. `expired` = the link ran out unpaid. */
/** `due` = balance still to pay for a booking (usually at the shop). */
export type PaymentState = 'due' | 'link_sent' | 'expired' | 'paid' | 'failed' | 'refunded';

/** One payment: for a booking or a membership plan. */
export interface Payment {
  /** e.g. PAY-1048 */
  id: string;
  kind: 'booking' | 'plan';
  /** Booking ID, or the plan and month ("Posh plan · Oct"). */
  reference: string;
  /** Service name, or "Plan renewal" / "First month". */
  item: string;
  /** What the money was for and how it came in, e.g. "Advance · Online", "Balance · Shop QR". */
  detail: string;
  customer: { id: string; name: string };
  amountPaise: Paise;
  status: PaymentState;
  /** When it last changed. ISO timestamp. */
  at: string;
  /** Super Admin can refund it (paid booking payments). */
  refundable: boolean;
}

export type PaymentTab = 'all' | 'due' | 'waiting' | 'paid' | 'failed' | 'refunded';

export interface PaymentFilters {
  tab: PaymentTab;
  /** YYYY-MM-DD, inclusive. */
  from: string;
  to: string;
  page: number;
  pageSize: number;
}

/** GET /admin/payments/summary for a period. */
export interface PaymentSummary {
  collectedPaise: Paise;
  collectedCount: number;
  /** Links still open now (any period). */
  waitingPaise: Paise;
  waitingCount: number;
  /** Balance still to pay on confirmed and completed bookings (any period). */
  duePaise: Paise;
  dueCount: number;
  failedCount: number;
  refundedPaise: Paise;
  refundedCount: number;
}
