// Date/time helpers. Dates are local calendar days (YYYY-MM-DD) and times are HH:mm,
// never UTC: toISOString() would show yesterday's date to an Indian user before 5:30 am.

const DATE_LABEL = new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
const DATE_LONG = new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const WEEKDAY = new Intl.DateTimeFormat('en-IN', { weekday: 'short' });
const MONTH = new Intl.DateTimeFormat('en-IN', { month: 'short' });

export function toIsoDate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** `count` consecutive dates starting at `from` (today by default). */
export function upcomingDates(count: number, from = new Date()): string[] {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + i);
    return toIsoDate(d);
  });
}

export function minutesOfDay(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function timeFromMinutes(minutes: number): string {
  const h = String(Math.floor(minutes / 60)).padStart(2, '0');
  const m = String(minutes % 60).padStart(2, '0');
  return `${h}:${m}`;
}

/** Local Date for a date + time pair. */
export function slotStart(date: string, time: string): Date {
  const d = parseIsoDate(date);
  d.setMinutes(minutesOfDay(time));
  return d;
}

/** "14:30" -> "2:30 PM". */
export function timeLabel(time: string): string {
  const minutes = minutesOfDay(time);
  const h = Math.floor(minutes / 60);
  const m = String(minutes % 60).padStart(2, '0');
  return `${h % 12 || 12}:${m} ${h < 12 ? 'AM' : 'PM'}`;
}

/** "2:30 PM – 4:00 PM". */
export function timeRangeLabel(time: string, durationMinutes: number): string {
  return `${timeLabel(time)} – ${timeLabel(timeFromMinutes(minutesOfDay(time) + durationMinutes))}`;
}

/** "Fri, 9 May". */
export function dateLabel(iso: string): string {
  return DATE_LABEL.format(parseIsoDate(iso));
}

/** "Friday, 9 May 2025". */
export function dateLongLabel(iso: string): string {
  return DATE_LONG.format(parseIsoDate(iso));
}

/** Pieces for a date tile: weekday ("Fri"), day ("9"), month ("May"). */
export function dateParts(iso: string): { weekday: string; day: number; month: string } {
  const d = parseIsoDate(iso);
  return { weekday: WEEKDAY.format(d), day: d.getDate(), month: MONTH.format(d) };
}
