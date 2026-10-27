import { PetType } from '../pets/pet.models';

/** Money is stored in paise (1 rupee = 100 paise) so totals never hit floating-point errors. */
export type Paise = number;

export interface ServiceItem {
  id: string;
  petType: PetType;
  icon: string;
  name: string;
  description: string;
  pricePaise: Paise;
  durationMinutes: number;
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
