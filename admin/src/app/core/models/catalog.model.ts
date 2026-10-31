/** Money is integer paise (1 rupee = 100 paise). */
export type Paise = number;

export type PetType = 'dog' | 'cat';

/** A grooming service as the admin manages it. */
export interface Service {
  id: string;
  name: string;
  petType: PetType;
  durationMinutes: number;
  pricePaise: Paise;
  active: boolean;
}

/** A grooming table; slots are booked per station. */
export interface Station {
  id: string;
  name: string;
}
