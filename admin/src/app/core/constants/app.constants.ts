import { StaffRole } from '../models/staff-user.model';

export const ROLE_LABELS: Record<StaffRole, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  staff: 'Staff',
};

/** Roles that can open Settings (Team & roles inside it is Super Admin only). */
export const SETTINGS_ROLES: StaffRole[] = ['super_admin', 'admin'];

/** Refundable "slot hold" amount when the customer doesn't pay in full. */
export const SLOT_HOLD_PAISE = 10000;

/** Payment links stop working after this long. */
export const PAYMENT_LINK_HOURS = 24;

/** Unpaid links older than this show under "Needs your attention". */
export const UNPAID_ALERT_HOURS = 6;

/** Requests waiting longer than this are shown as urgent. */
export const URGENT_REQUEST_MINUTES = 30;

/** Business details used in messages. Placeholders until Settings › Business exists (Phase F). */
export const BUSINESS_NAME = 'Posh Paws';

/** Shown under the slot picker. Matches the booking rules until Settings › Booking & availability exists (Phase F). */
export const BOOKING_RULES_NOTE = 'Start times have a station free for the whole service plus a 15 min buffer. Lunch 14:00–14:30 is blocked.';
