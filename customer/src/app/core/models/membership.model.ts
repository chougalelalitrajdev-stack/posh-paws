import { Paise } from './catalog.model';

/** GET /subscriptions/current: the logged-in customer's plan, or null. Staff can change it from the admin. */
export interface Membership {
  planId: string;
  planName: string;
  /** What they pay each month. */
  pricePaise: Paise;
  /** payment_pending: subscribed, first month not paid yet. */
  status: 'active' | 'payment_pending';
  /** null = unlimited. */
  sessionsTotal: number | null;
  sessionsUsed: number;
  sessionsLeft: number | null;
  /** Off services a session doesn't cover. */
  discountPercent: number;
  /** YYYY-MM-DD */
  renewsOn: string | null;
  /** A downgrade that starts at `renewsOn`. */
  nextPlanName: string | null;
}
