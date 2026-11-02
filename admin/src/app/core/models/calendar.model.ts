import { Booking } from './booking.model';
import { Station } from './catalog.model';
import { DayHours } from './settings.model';

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

/** Staff changes to one day's usual start times (the slot board). */
export interface SlotChanges {
  /** YYYY-MM-DD */
  date: string;
  /** Usual start times staff closed: no new bookings start then. */
  closed: string[];
  /** Extra start times staff opened (after hours, in the break, off the usual step). */
  extra: string[];
}

/** One start time on the slot board. */
export interface BoardSlot {
  /** HH:mm */
  time: string;
  /** open: a usual start time · closed: staff closed it · extra: staff opened it. */
  state: 'open' | 'closed' | 'extra';
  /** Stations free for a visit starting then (one slot step long). */
  freeStations: number;
  /** Why it can't be booked whatever its state, e.g. "Past", "Break", "Closed · Diwali". */
  blockedBy: string | null;
}

/** GET /admin/slot-board?date= : the start times customers can book on one day. */
export interface SlotBoard {
  date: string;
  hours: Omit<DayHours, 'day'>;
  /** A holiday closure on this day; closesAt null = closed all day. */
  closure: { name: string; closesAt: string | null } | null;
  stepMinutes: number;
  stations: number;
  slots: BoardSlot[];
}

/** GET /admin/slots: one entry per day. */
export interface DayAvailability {
  /** YYYY-MM-DD */
  date: string;
  slots: TimeSlot[];
}
