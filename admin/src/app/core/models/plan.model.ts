import { Paise } from './catalog.model';

export type Billing = 'month' | 'quarter' | 'year';

export interface PlanBenefit {
  text: string;
  /** Not included benefits are shown crossed out, to compare plans. */
  included: boolean;
}

/** A membership plan (Catalog › Membership plans). */
export interface Plan {
  id: string;
  name: string;
  tagline: string;
  pricePaise: Paise;
  billing: Billing;
  /** null = unlimited. */
  sessionsPerPeriod: number | null;
  /** Percent off services. */
  discountPercent: number;
  /** Services a plan session can be used for. */
  eligibleServiceIds: string[];
  /** Shown to customers, in order. */
  benefits: PlanBenefit[];
  /** Badge "Most popular"; only one plan at a time. */
  featured: boolean;
  /** Customers can subscribe in the app. */
  subscribable: boolean;
  /** Worked out by the server. */
  activeSubscribers: number;
}

/** Body of POST /admin/plans and PUT /admin/plans/{id}. */
export type PlanDraft = Omit<Plan, 'id' | 'activeSubscribers'>;
