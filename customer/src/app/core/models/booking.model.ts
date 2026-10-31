import { Paise } from './catalog.model';
import { PetType } from './pet.model';

export type BookingStatus = 'confirmed' | 'completed' | 'cancelled';

/** An appointment as the API returns it. Service and pet details are copied in when booked. */
export interface Booking {
  id: string;
  serviceId: string;
  serviceName: string;
  serviceIcon: string;
  petId: string;
  petName: string;
  petType: PetType;
  /** YYYY-MM-DD */
  date: string;
  /** HH:mm (24h) */
  time: string;
  durationMinutes: number;
  pricePaise: Paise;
  /** Paid online to hold the slot; the rest is paid at the salon. */
  depositPaise: Paise;
  notes?: string;
  status: BookingStatus;
  createdAt: string;
}

/** Body of POST /bookings. The server fills in names, prices and status. */
export interface BookingRequest {
  serviceId: string;
  petId: string;
  date: string;
  time: string;
  notes?: string;
}

/** One start time from GET /slots. */
export interface TimeSlot {
  /** HH:mm (24h) */
  time: string;
  available: boolean;
}
