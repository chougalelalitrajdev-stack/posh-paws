import { BookingSource, BookingStage, CallOutcome, PaymentStatus } from '../models/booking.model';

/** Colour family of a pill or calendar block; each has a .pp-tone-* class in styles/components/_tones.scss. */
export type Tone = 'info' | 'draft' | 'warn' | 'success' | 'neutral' | 'danger';

export const STAGES: Record<BookingStage, { label: string; tone: Tone }> = {
  request: { label: 'Request', tone: 'info' },
  draft: { label: 'Draft', tone: 'draft' },
  awaiting_payment: { label: 'Awaiting payment', tone: 'warn' },
  confirmed: { label: 'Confirmed', tone: 'success' },
  completed: { label: 'Completed', tone: 'neutral' },
  cancelled: { label: 'Cancelled', tone: 'danger' },
  no_show: { label: 'No-show', tone: 'danger' },
};

export const PAYMENT_STATUSES: Record<PaymentStatus, { label: string; tone: Tone }> = {
  not_requested: { label: 'Not requested', tone: 'neutral' },
  link_sent: { label: 'Link sent', tone: 'warn' },
  paid: { label: 'Paid', tone: 'success' },
  failed: { label: 'Failed', tone: 'danger' },
  refunded: { label: 'Refunded', tone: 'info' },
};

export const SOURCES: Record<BookingSource, string> = {
  app: 'From the app',
  phone: 'By phone',
  walk_in: 'Walk-in',
};

export const CALL_OUTCOMES: { value: CallOutcome; label: string }[] = [
  { value: 'reached', label: 'Reached' },
  { value: 'no_answer', label: 'No answer' },
  { value: 'call_back_later', label: 'Call back later' },
];

/** Tabs on the Bookings list, in order. Each tab shows one or more stages. */
export const BOOKING_TABS: { key: string; label: string; stages: BookingStage[] }[] = [
  { key: 'all', label: 'All', stages: [] },
  { key: 'request', label: 'Requests', stages: ['request'] },
  { key: 'draft', label: 'Drafts', stages: ['draft'] },
  { key: 'awaiting_payment', label: 'Awaiting payment', stages: ['awaiting_payment'] },
  { key: 'confirmed', label: 'Confirmed', stages: ['confirmed'] },
  { key: 'completed', label: 'Completed', stages: ['completed'] },
  { key: 'cancelled', label: 'Cancelled', stages: ['cancelled', 'no_show'] },
];
