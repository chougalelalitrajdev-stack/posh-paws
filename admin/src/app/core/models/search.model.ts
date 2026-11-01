import { BookingStage } from './booking.model';
import { PetType } from './catalog.model';

/** GET /admin/search?q= : a few matches of each kind for the top-bar search. */
export interface SearchResults {
  customers: { id: string; name: string; phone: string; petNames: string[] }[];
  pets: { id: string; name: string; type: PetType; breed?: string; ownerName: string }[];
  bookings: { id: string; customerName: string; petName?: string; serviceName?: string; date: string | null; time: string | null; stage: BookingStage }[];
}
