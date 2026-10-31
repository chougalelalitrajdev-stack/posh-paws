import { Paise } from './catalog.model';

export type SubscriptionStatus = 'active' | 'payment_pending' | 'expired' | 'cancelled';

/** Tabs on the Subscriptions screen. "renewing" = active and renewing within 7 days. */
export type SubscriptionTab = 'all' | 'active' | 'renewing' | 'pending' | 'ended';

export interface Subscription {
  id: string;
  customer: { id: string; name: string; phone: string };
  planName: string;
  pricePaise: Paise;
  /** null = unlimited sessions. */
  sessionsTotal: number | null;
  sessionsUsed: number;
  /** YYYY-MM-DD */
  startedOn: string;
  renewsOn: string | null;
  endedOn: string | null;
  status: SubscriptionStatus;
  /** Set once a renewal or first-payment link has been sent. */
  paymentLink: { link: string; sentAt: string } | null;
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
