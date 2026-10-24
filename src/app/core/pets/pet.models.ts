export type PetType = 'dog' | 'cat';
export type PetGender = 'male' | 'female';
export type PetSize = 'small' | 'medium' | 'large';
export type PetCoat = 'short' | 'medium' | 'long' | 'curly' | 'double';
export type PetTemperament = 'calm' | 'friendly' | 'playful' | 'anxious' | 'shy-with-strangers';
export type VaccinationStatus = 'up-to-date' | 'due-soon' | 'not-vaccinated' | 'unknown';

export interface Pet {
  id: string;
  type: PetType;
  name: string;
  breed?: string;
  /** ISO date (YYYY-MM-DD); estimated from age when the owner doesn't know it. */
  birthDate?: string;
  gender?: PetGender;
  size?: PetSize;
  coat?: PetCoat;
  temperament: PetTemperament[];
  vaccination?: VaccinationStatus;
  notes?: string;
}

export type PetDraft = Omit<Pet, 'id'>;
