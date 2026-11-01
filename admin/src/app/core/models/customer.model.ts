import { PetType, Paise } from './catalog.model';

export interface CustomerPet {
  id: string;
  name: string;
  type: PetType;
  breed?: string;
  /** YYYY-MM-DD */
  birthDate?: string;
  gender?: 'male' | 'female';
  weightKg?: number;
  /** Size and coat, e.g. "Small · long". */
  coat?: string;
  temperament?: string;
  vaccination?: 'up_to_date' | 'due_soon' | 'not_vaccinated' | 'unknown';
  /** Grooming notes staff should see before every visit. */
  notes?: string;
  healthNotes?: string;
}

/** Body of POST /admin/customers/{id}/pets and PUT /admin/pets/{id}. */
export type PetDraft = Omit<CustomerPet, 'id'>;

/** The customer's active membership. Comes from their subscription. */
export interface CustomerPlan {
  subscriptionId: string;
  name: string;
  /** Percent off services, e.g. 10. */
  discountPercent: number;
  pricePaise: Paise;
  /** null = unlimited sessions. */
  sessionsLeft: number | null;
  sessionsTotal: number | null;
  /** YYYY-MM-DD */
  renewsOn: string | null;
}

export interface StaffNote {
  text: string;
  by: string;
  /** ISO timestamp */
  at: string;
}

export interface Customer {
  id: string;
  name: string;
  /** Digits only, 10 numbers. */
  phone: string;
  email?: string;
  /** Neighbourhood, e.g. "Viman Nagar, Pune". */
  area?: string;
  /** ISO timestamp of the first booking or request. */
  customerSince: string;
  plan: CustomerPlan | null;
  pets: CustomerPet[];
  staffNote?: StaffNote | null;
  // Worked out by the server from bookings and payments:
  pastBookings: number;
  bookingsCount: number;
  openRequests: number;
  spentPaise: Paise;
  /** Last completed visit. */
  lastVisit?: { date: string; serviceName: string; petName: string };
}

/** One row of GET /admin/customers. */
export interface CustomerSummary {
  id: string;
  name: string;
  phone: string;
  petNames: string[];
  planName: string | null;
  bookingsCount: number;
  spentPaise: Paise;
  /** YYYY-MM-DD of the last completed visit. */
  lastVisit: string | null;
  /** Not seen in 90 days. */
  lapsed: boolean;
  /** The next thing coming up for this customer. */
  next: { kind: 'booking' | 'request' | 'draft'; date?: string; time?: string } | null;
}

export type CustomerSegment = 'all' | 'members' | 'new' | 'lapsed' | 'no_plan';

export interface CustomerFilters {
  q?: string;
  segment?: CustomerSegment;
  plan?: string;
  petType?: PetType;
  sort?: 'last_visit' | 'name' | 'spent';
  page?: number;
  pageSize?: number;
}

/** Body of POST /admin/customers and PUT /admin/customers/{id}. */
export interface CustomerDetails {
  name: string;
  phone: string;
  email?: string;
  area?: string;
}

