import { Booking } from './booking.model';
import { Paise } from './catalog.model';

/** GET /admin/dashboard: everything the Today screen shows, in one call. */
export interface DashboardSummary {
  openStations: number;
  awaitingPayment: { count: number; outstandingPaise: Paise; failed: number };
  /** Today's appointments; `duePaise` is what's still to collect at the shop from them. */
  today: { count: number; done: number; nextTime: string | null; duePaise: Paise; dueCount: number };
  renewalsThisWeek: number;
  attention: AttentionItem[];
  schedule: Booking[];
  payments: { totalPaise: Paise; count: number; failed: number; refunds: number; days: { date: string; amountPaise: Paise }[] };
  memberships: { active: number; renewThisWeek: number; expired: number; plans: { name: string; count: number }[] };
  content: { title: string; where: string; status: string; tone: 'success' | 'warn' | 'draft' }[];
}

export interface AttentionItem {
  kind: 'failed' | 'unpaid' | 'draft' | 'content';
  title: string;
  detail: string;
  /** ISO timestamp used for "oldest first" and the age text. */
  at: string;
  /** App route the action button opens. */
  link: string;
  queryParams?: Record<string, string>;
  action: string;
}
