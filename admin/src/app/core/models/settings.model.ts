import { Paise } from './catalog.model';

/** Shown in the customer app's footer and on the Call and WhatsApp buttons. */
export interface BusinessSettings {
  name: string;
  phone: string;
  whatsapp: string;
  email: string;
  instagram: string;
  mapsLink: string;
  address: string;
}

export interface DayHours {
  /** 0 = Monday … 6 = Sunday. */
  day: number;
  open: boolean;
  /** HH:mm */
  opens: string;
  closes: string;
  /** Break blocked on every station; null = no break. */
  breakFrom: string | null;
  breakTo: string | null;
}

export interface Closure {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  name: string;
  /** Closing early at this time (HH:mm); null = closed all day. */
  closesAt: string | null;
  /** Bookings already on that day (after `closesAt`). Worked out by the server. */
  affectedBookings: number;
}

/** Slot rules. The backend applies them when it offers slots. */
export interface BookingSettings {
  hours: DayHours[];
  slotStepMinutes: number;
  /** Cleaning time kept free after every appointment. */
  bufferMinutes: number;
  bookAheadDays: number;
  minNoticeMinutes: number;
  /** Changed with their own endpoints, not with the section. */
  closures: Closure[];
}

export interface PaymentSettings {
  currency: 'INR';
  linkExpiryHours: number;
  slotHoldPaise: Paise;
  /** null until a payment gateway is connected. */
  provider: string | null;
}

export interface NotificationSettings {
  /** Booking reminders go out at this time the day before (HH:mm). */
  reminderTime: string;
  /** Follow up an unpaid link, and flag it on Today, after this many hours. */
  unpaidNudgeHours: number;
  /** Who hears about new callback requests. */
  staffAlerts: 'admins' | 'everyone';
}

export interface AppSettings {
  bookButtonText: string;
  showPrices: boolean;
}

/** GET /admin/settings. Each section is saved on its own with PUT /admin/settings/{section}. */
export interface Settings {
  business: BusinessSettings;
  booking: BookingSettings;
  payments: PaymentSettings;
  notifications: NotificationSettings;
  app: AppSettings;
}

export type SettingsSection = keyof Settings;
