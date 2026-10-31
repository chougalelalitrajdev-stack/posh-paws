export type TemplateKey =
  | 'payment_link' | 'booking_confirmed' | 'booking_reminder' | 'unpaid_nudge'
  | 'callback_received' | 'missed_call'
  | 'plan_payment' | 'plan_renewal' | 'plan_welcome' | 'win_back';

/** WhatsApp checks templates before they can be sent automatically; staff can always send them by hand. */
export type TemplateApproval = 'approved' | 'pending' | 'draft';

/** A WhatsApp message with {fields} filled in for each customer (Business › Message templates). */
export interface MessageTemplate {
  key: TemplateKey;
  group: 'Bookings' | 'Requests' | 'Membership';
  name: string;
  body: string;
  /** When it goes out, e.g. "At 18:00 the day before". */
  trigger: string;
  /** False for messages staff send by hand from a screen. */
  canAutoSend: boolean;
  autoSend: boolean;
  approval: TemplateApproval;
  updatedAt: string;
  updatedBy: string;
}

/** Values for the {fields} in a template. Missing ones stay as {field}. */
export type TemplateValues = Partial<Record<TemplateField, string>>;

export type TemplateField =
  | 'customer_name' | 'pet_name' | 'service' | 'date_time' | 'amount' | 'payment_link' | 'link_hours' | 'plan' | 'renewal_date';
