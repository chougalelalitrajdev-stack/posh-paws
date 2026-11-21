import { CoatType, PetGender, PetOption, PetTemperament, PetType, VaccinationStatus } from '../models/pet.model';

export const PET_TYPE_OPTIONS: PetOption<PetType>[] = [
  { value: 'dog', label: 'Dog' },
  { value: 'cat', label: 'Cat' },
];

export const PET_GENDER_OPTIONS: PetOption<PetGender>[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
];

export const PET_TEMPERAMENT_OPTIONS: PetOption<PetTemperament>[] = [
  { value: 'calm', label: 'Calm' },
  { value: 'friendly', label: 'Friendly' },
  { value: 'playful', label: 'Playful' },
  { value: 'anxious', label: 'Anxious' },
  { value: 'shy-with-strangers', label: 'Shy with strangers' },
];

export const VACCINATION_OPTIONS: PetOption<VaccinationStatus>[] = [
  { value: 'up-to-date', label: 'Up to date' },
  { value: 'due-soon', label: 'Due soon' },
  { value: 'not-vaccinated', label: 'Not vaccinated' },
  { value: 'unknown', label: 'Not sure' },
];

export const COAT_LABELS: Record<CoatType, string> = { single: 'Single coat', double: 'Double coat', triple: 'Triple coat' };

export const PET_EMOJI: Record<PetType, string> = { dog: '🐶', cat: '🐱' };
