import { CustomerPet } from './customer.model';

export interface PetOwner {
  id: string;
  name: string;
  phone: string;
}

/** One row of GET /admin/pets. */
export interface PetSummary {
  pet: CustomerPet;
  owner: PetOwner;
  /** YYYY-MM-DD of the last completed groom. */
  lastGroom: string | null;
}

/** GET /admin/pets/{id}: the pet, its owner and past visits. */
export interface PetRecord extends PetSummary {
  visits: { bookingId: string; serviceName: string; date: string }[];
}

export interface PetFilters {
  q?: string;
  type?: 'dog' | 'cat';
  vaccinationDue?: boolean;
  page?: number;
  pageSize?: number;
}

/** GET /admin/pets/counts */
export interface PetCounts {
  all: number;
  dog: number;
  cat: number;
}
