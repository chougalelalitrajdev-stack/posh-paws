import { Paise } from './catalog.model';

export type OfferStatus = 'draft' | 'scheduled' | 'live' | 'paused' | 'expired' | 'used_up';
export type OfferScope = 'all_services' | 'some_services' | 'plans';

/** A discount or coupon code (Catalog › Offers). */
export interface Offer {
  id: string;
  title: string;
  discountType: 'percent' | 'flat';
  /** Percent (e.g. 15) or paise for a flat discount. */
  value: number;
  /** null = applied automatically, no code needed. */
  code: string | null;
  appliesTo: OfferScope;
  /** When appliesTo is 'some_services'. */
  serviceIds: string[];
  /** YYYY-MM-DD */
  startsOn: string;
  endsOn: string | null;
  /** null = no limit. */
  totalUses: number | null;
  perCustomer: number | null;
  newCustomersOnly: boolean;
  draft: boolean;
  paused: boolean;
  used: number;
  /** Worked out by the server from the dates, limits and flags. */
  status: OfferStatus;
}

/** Body of POST /admin/offers and PUT /admin/offers/{id}. */
export type OfferDraft = Omit<Offer, 'id' | 'used' | 'status' | 'paused'>;
