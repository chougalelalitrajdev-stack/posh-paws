import { Booking } from './booking.model';
import { Station } from './catalog.model';

/** Time a station can't be booked (lunch, a meeting, maintenance). */
export interface TimeBlock {
  id: string;
  stationId: string;
  /** YYYY-MM-DD, HH:mm */
  date: string;
  time: string;
  durationMinutes: number;
  reason: string;
  /** Rule-based blocks like lunch can't be removed from the calendar. */
  fixed: boolean;
}

/** Body of POST /admin/blocks. */
export type NewTimeBlock = Omit<TimeBlock, 'id' | 'fixed'>;

/** GET /admin/calendar?from=&days= */
export interface CalendarData {
  stations: Station[];
  bookings: Booking[];
  blocks: TimeBlock[];
  /** Opening hours as HH:mm. */
  opens: string;
  closes: string;
}

export interface TimeSlot {
  /** HH:mm */
  time: string;
  available: boolean;
}

/** GET /admin/slots: one entry per day. */
export interface DayAvailability {
  /** YYYY-MM-DD */
  date: string;
  slots: TimeSlot[];
}
