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
