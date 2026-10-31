import { BookingSource, BookingStage, CallOutcome, PaymentStatus } from '../models/booking.model';
import { BannerStatus } from '../models/banner.model';
import { OfferStatus } from '../models/offer.model';
import { PaymentState } from '../models/payment.model';
import { TemplateApproval } from '../models/template.model';

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

export const OFFER_STATUSES: Record<OfferStatus, { label: string; tone: Tone }> = {
  live: { label: 'Live', tone: 'success' },
  scheduled: { label: 'Scheduled', tone: 'info' },
  paused: { label: 'Paused', tone: 'warn' },
  draft: { label: 'Draft', tone: 'draft' },
  used_up: { label: 'Used up', tone: 'neutral' },
  expired: { label: 'Ended', tone: 'neutral' },
};

export const BANNER_STATUSES: Record<BannerStatus, { label: string; tone: Tone }> = {
  live: { label: 'Live', tone: 'success' },
  scheduled: { label: 'Scheduled', tone: 'info' },
  paused: { label: 'Paused', tone: 'warn' },
  ended: { label: 'Ended', tone: 'neutral' },
};

/** Payments list and a customer's Payments tab (a link that ran out shows as Expired). */
export const PAYMENT_STATES: Record<PaymentState, { label: string; tone: Tone }> = {
  link_sent: { label: 'Link sent', tone: 'warn' },
  expired: { label: 'Expired', tone: 'neutral' },
  paid: { label: 'Paid', tone: 'success' },
  failed: { label: 'Failed', tone: 'danger' },
  refunded: { label: 'Refunded', tone: 'info' },
};

export const TEMPLATE_APPROVALS: Record<TemplateApproval, { label: string; tone: Tone }> = {
  approved: { label: 'Approved by WhatsApp', tone: 'success' },
  pending: { label: 'Waiting for WhatsApp approval', tone: 'warn' },
  draft: { label: 'Draft', tone: 'draft' },
};
