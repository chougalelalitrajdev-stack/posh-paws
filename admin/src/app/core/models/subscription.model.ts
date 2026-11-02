import { PaymentMethod } from './booking.model';
import { Paise } from './catalog.model';

export type SubscriptionStatus = 'active' | 'payment_pending' | 'expired' | 'cancelled';

/** Tabs on the Subscriptions screen. "renewing" = active and renewing within 7 days. */
export type SubscriptionTab = 'all' | 'active' | 'renewing' | 'pending' | 'ended';

export interface Subscription {
  id: string;
  customer: { id: string; name: string; phone: string };
  planId: string;
  /** Name when subscribed (a snapshot). */
  planName: string;
  /** What this member pays. Plan price changes reach them at their next renewal. */
  pricePaise: Paise;
  /** null = unlimited sessions. */
  sessionsTotal: number | null;
  sessionsUsed: number;
  /** YYYY-MM-DD */
  startedOn: string;
  renewsOn: string | null;
  endedOn: string | null;
  status: SubscriptionStatus;
  /** Set once a renewal or first-payment link has been sent; it charges `amountPaise` for `planName`. */
  paymentLink: { link: string; sentAt: string; amountPaise: Paise; planName: string } | null;
  /** A downgrade waiting for the next renewal (`renewsOn`). */
  nextPlan: { planId: string; planName: string; pricePaise: Paise } | null;
  /** Plan changes, newest first. */
  changes: PlanChange[];
}

/**
 * upgrade: starts now, the price difference is paid now, renewal date stays.
 * downgrade: starts at the next renewal. switch: not paid yet, so it changes now for free.
 * keep: a waiting downgrade was called off.
 */
export type PlanChangeKind = 'upgrade' | 'downgrade' | 'switch' | 'keep';

export interface PlanChange {
  at: string;
  kind: PlanChangeKind;
  fromPlan: string;
  toPlan: string;
  /** Upgrade: the difference paid now, and how. */
  paidPaise: Paise;
  method: Exclude<PaymentMethod, 'online'> | null;
  by: string;
}

/** GET /admin/subscriptions/{id}/plan-options: every plan, with what moving to it would mean. */
export interface PlanOption {
  planId: string;
  name: string;
  pricePaise: Paise;
  /** null = unlimited. */
  sessionsPerPeriod: number | null;
  discountPercent: number;
  /** current = their plan now (choosing it calls off a waiting downgrade). */
  change: PlanChangeKind | 'current';
  /** What they pay now: the difference for this period on an upgrade, else 0. */
  payNowPaise: Paise;
  /** YYYY-MM-DD the change starts. */
  startsOn: string;
  /** Sessions left this period after the change; null = unlimited. */
  sessionsLeft: number | null;
}

/** Body of POST /admin/subscriptions/{id}/change-plan. `method` is needed when an upgrade has a difference to pay. */
export interface PlanChangeRequest {
  planId: string;
  method?: Exclude<PaymentMethod, 'online'>;
}

/** GET /admin/subscriptions/summary */
export interface SubscriptionSummary {
  active: number;
  byPlan: { name: string; count: number }[];
  monthlyPaise: Paise;
  renewingSoon: number;
  /** Renewing soon with no link sent yet. */
  needLink: number;
  endedThisMonth: number;
  expiredThisMonth: number;
  cancelledThisMonth: number;
  counts: Record<SubscriptionTab, number>;
}
