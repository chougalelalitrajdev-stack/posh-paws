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
  /** Archived services are gone from the app and from new bookings. */
  archived: boolean;
  /** Position within its pet type (0 = first). */
  sortOrder: number;
  /** Upcoming bookings for this service (worked out by the server). */
  upcomingBookings: number;
}

/** Body of POST /admin/services and PUT /admin/services/{id}. */
export type ServiceDraft = Pick<Service, 'name' | 'petType' | 'category' | 'description' | 'durationMinutes' | 'pricePaise' | 'imageUrl' | 'visible'>;

/** A grooming table; slots are booked per station. */
export interface Station {
  id: string;
  name: string;
}
