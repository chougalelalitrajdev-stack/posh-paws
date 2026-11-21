/** Money is integer paise (1 rupee = 100 paise). */
export type Paise = number;

export type PetType = 'dog' | 'cat';

export type ServiceCategory = 'Bath' | 'Haircut' | 'Package' | 'Add-on' | 'Treatment';

/** A grooming service as the admin manages it. */
export interface Service {
  id: string;
  name: string;
  petType: PetType;
  category: ServiceCategory;
  /** Shown on the service card in the app; keep it under 140 characters. */
  description: string;
  durationMinutes: number;
  pricePaise: Paise;
  imageUrl?: string;
  /** Shown in the customer app. Hidden services can still be booked by staff. */
  visible: boolean;
  /** The pet's breed, weight and coat extras (Catalog › Pet pricing) are added to the price. Off for add-ons like a nail trim. */
  petPricing: boolean;
  /** Archived services are gone from the app and from new bookings. */
  archived: boolean;
  /** Position within its pet type (0 = first). */
  sortOrder: number;
  /** Upcoming bookings for this service (worked out by the server). */
  upcomingBookings: number;
}

/** Body of POST /admin/services and PUT /admin/services/{id}. */
export type ServiceDraft = Pick<Service, 'name' | 'petType' | 'category' | 'description' | 'durationMinutes' | 'pricePaise' | 'imageUrl' | 'visible' | 'petPricing'>;

// ── Pet pricing (Catalog › Pet pricing): what a pet's breed, weight and coat add to services that have petPricing on ──

export type CoatType = 'single' | 'double' | 'triple';

/** A weight band; upToKg null is the last one, everything above the band before. */
export interface WeightBand {
  upToKg: number | null;
  extraPaise: Paise;
}

export interface CoatPrice {
  type: CoatType;
  /** "Double coat" */
  label: string;
  /** Shown to customers under the choice, to help them pick. */
  note: string;
  extraPaise: Paise;
}

/** A breed on the list; id is null for one added before saving. */
export interface BreedPrice {
  id: string | null;
  name: string;
  extraPaise: Paise;
}

export interface PetTypePricing {
  breeds: BreedPrice[];
  weightBands: WeightBand[];
  coats: CoatPrice[];
}

/** GET and PUT /admin/pet-pricing. */
export type PetPricing = Record<PetType, PetTypePricing>;

/** What a station can do: every service, every dog or cat service, or the chosen ones. */
export type StationScope = 'all' | 'dogs' | 'cats' | 'some';

/**
 * A grooming table or room (Availability › Stations). Each booking holds one station for the service plus cleaning,
 * so the stations in use decide how many pets are groomed at once.
 */
export interface Station {
  id: string;
  name: string;
  /** Off: no new bookings on it (repairs, groomer on leave); bookings already on it stay. */
  active: boolean;
  canDo: StationScope;
  /** canDo = 'some': the services it can do. */
  serviceIds: string[];
  /** Held back: staff can always book it (it's used last); customers only get it at the start times opened on Availability › Day. */
  heldBack: boolean;
}

/** Body of POST /admin/stations and PUT /admin/stations/{id}. */
export type StationDraft = Omit<Station, 'id'>;
