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

/** Body of POST /admin/blocks. `allDay` blocks the station from opening to closing (a day off), ignoring time and duration. */
export type NewTimeBlock = Omit<TimeBlock, 'id' | 'fixed'> & { allDay?: boolean };

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
  /** Open but no station customers can get, and why: Fully booked, Blocked, Runs into break, No station open… */
  fullReason?: string | null;
  /** What the weekly pattern says about this time (Availability › Week); the day's own change wins. */
  weekly: 'closed' | 'extra' | null;
}

/** A held-back station on the slot board: customers only get it at the times opened for them. */
export interface HeldBackStation {
  id: string;
  name: string;
  /** Start times (HH:mm) opened to customers on this day. */
  opened: string[];
  /** Start times it's free for a visit starting then. */
  free: string[];
  /** The other start times, and why: Booked, Blocked, Runs into break, Runs past closing. */
  busy: Record<string, string>;
}

/** GET /admin/slot-board?date= : the start times customers can book on one day. */
export interface SlotBoard {
  date: string;
  hours: Omit<DayHours, 'day'>;
  /** A holiday closure on this day; closesAt null = closed all day. */
  closure: { name: string; closesAt: string | null } | null;
  stepMinutes: number;
  stations: number;
  /** freeStations counts what customers can get: a held-back station only at its opened times. */
  slots: BoardSlot[];
  heldBack: HeldBackStation[];
}

/** One start time in the usual week. break = inside the break, so not bookable unless opened as an extra time on a day. */
export interface WeekSlot {
  time: string;
  state: 'open' | 'closed' | 'extra' | 'break';
}

/** GET /admin/slot-board/week: the start times of the usual week, per weekday (0 = Monday). */
export interface WeekBoard {
  stepMinutes: number;
  days: (DayHours & { slots: WeekSlot[] })[];
}

/** GET /admin/slots: one entry per day. */
export interface DayAvailability {
  /** YYYY-MM-DD */
  date: string;
  slots: TimeSlot[];
}
