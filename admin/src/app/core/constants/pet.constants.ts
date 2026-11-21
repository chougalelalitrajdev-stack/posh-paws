import { CoatType } from '../models/catalog.model';
import { CustomerPet } from '../models/customer.model';
import { Tone } from './status.constants';

export type Vaccination = NonNullable<CustomerPet['vaccination']>;

export const VACCINATION: Record<Vaccination, { label: string; tone: Tone }> = {
  up_to_date: { label: 'Up to date', tone: 'success' },
  due_soon: { label: 'Due soon', tone: 'warn' },
  not_vaccinated: { label: 'Not vaccinated', tone: 'danger' },
  unknown: { label: 'Not sure', tone: 'neutral' },
};

export const VACCINATION_OPTIONS = (Object.keys(VACCINATION) as Vaccination[]).map(value => ({ value, label: VACCINATION[value].label }));

export const COAT_LABELS: Record<CoatType, string> = { single: 'Single coat', double: 'Double coat', triple: 'Triple coat' };

/** Breed, weight and coat are filled in, so the pet can be priced and booked (pets added before they were required may lack them). */
export const isPriced = (p: CustomerPet): boolean => !!(p.breedId && p.weightKg && p.coatType);

/** "Golden Retriever · 31 kg · Double coat", or what's known so far. */
export const petDetails = (p: CustomerPet): string =>
  [p.breed ?? (p.type === 'dog' ? 'Dog' : 'Cat'), p.weightKg ? `${p.weightKg} kg` : '', p.coatType ? COAT_LABELS[p.coatType] : ''].filter(Boolean).join(' · ');
