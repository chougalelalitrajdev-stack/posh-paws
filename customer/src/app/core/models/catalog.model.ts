import { PetType } from './pet.model';

/** Money is stored in paise (1 rupee = 100 paise) so totals never hit floating-point errors. */
export type Paise = number;

export interface ServiceItem {
  id: string;
  petType: PetType;
  icon: string;
  name: string;
  description: string;
  /** The starting price; with petPricing the pet's breed, weight and coat can add to it ("From ₹1,200"). */
  pricePaise: Paise;
  petPricing: boolean;
  durationMinutes: number;
  /** The service's photo (Catalog › Services in the admin), when it has one. */
  imageUrl?: string | null;
}

export interface PlanFeature {
  text: string;
  included: boolean;
}

export interface PlanItem {
  id: string;
  name: string;
  tagline: string;
  pricePaise: Paise;
  billing: 'month';
  featured: boolean;
  badge?: string;
  features: PlanFeature[];
}

export interface Testimonial {
  id: string;
  initial: string;
  quote: string;
  author: string;
  petLine: string;
}

export interface ProcessStep {
  num: string;
  title: string;
  description: string;
}

/** Icon + title + one-line description, used for feature lists. */
export interface Highlight {
  icon: string;
  title: string;
  description: string;
}

/** Settings › Business in the admin: shown in the footer and on Call / WhatsApp buttons. */
export interface BusinessInfo {
  name: string;
  phone: string;
  whatsapp: string;
  email: string;
  instagram: string;
  mapsLink: string;
  address: string;
}

/** One weekday's usual hours (0 = Monday). */
export interface OpeningHours {
  day: number;
  open: boolean;
  opens: string;
  closes: string;
}

/** GET /shop: what the app shows from Settings (contact details, hours, how payments work). */
export interface ShopInfo {
  business: BusinessInfo;
  hours: OpeningHours[];
  /** Paid online to confirm an app booking. */
  advancePaise: Paise;
  /** Cancelling at least this many hours before refunds the advance. */
  freeCancellationHours: number;
  /** The shop's UPI ID and QR, for paying the balance after the groom. */
  upiId: string;
  qrImageUrl: string | null;
}
