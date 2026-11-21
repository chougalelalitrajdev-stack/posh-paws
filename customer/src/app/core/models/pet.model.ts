export type PetType = 'dog' | 'cat';
export type PetGender = 'male' | 'female';
export type CoatType = 'single' | 'double' | 'triple';
export type PetTemperament = 'calm' | 'friendly' | 'playful' | 'anxious' | 'shy-with-strangers';
export type VaccinationStatus = 'up-to-date' | 'due-soon' | 'not-vaccinated' | 'unknown';

export interface Pet {
  id: string;
  type: PetType;
  name: string;
  /**
   * Breed (from the shop's list, GET /pet-options), weight and coat set the price of most services, so they're required.
   * Only pets added before that can lack them; the app asks for them before the next booking.
   */
  breedId?: string | null;
  /** The breed's name (comes with the pet; not sent). */
  breed?: string | null;
  weightKg?: number | null;
  coatType?: CoatType | null;
  /** ISO date (YYYY-MM-DD); estimated from age when the owner doesn't know it. */
  birthDate?: string;
  gender?: PetGender;
  temperament: PetTemperament[];
  vaccination?: VaccinationStatus;
  notes?: string;
}

export type PetDraft = Omit<Pet, 'id' | 'breed'>;

/** A value + label pair for chip pickers and labels. */
export interface PetOption<T extends string> {
  value: T;
  label: string;
}

/** A coat to choose, with the shop's note that helps pick the right one. */
export interface CoatOption {
  type: CoatType;
  label: string;
  note: string;
}

/** GET /pet-options: the breeds and coats the pet form offers, per pet type (no prices: those come with the bill). */
export type PetOptions = Record<PetType, { breeds: { id: string; name: string }[]; coats: CoatOption[] }>;
