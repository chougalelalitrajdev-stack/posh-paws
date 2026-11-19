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

/** "09:00" -> "9 AM", "09:30" -> "9:30 AM" (for opening hours). */
export function shortTimeLabel(time: string): string {
  const minutes = minutesOfDay(time);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h % 12 || 12}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h < 12 ? 'AM' : 'PM'}`;
}

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** The usual week in a few lines, days in a row with the same hours together: ["Monday – Saturday: 9 AM – 7 PM", "Sunday: Closed"]. */
export function hoursSummary(hours: { day: number; open: boolean; opens: string; closes: string }[]): string[] {
  const label = (h: (typeof hours)[number]) => (h.open ? `${shortTimeLabel(h.opens)} – ${shortTimeLabel(h.closes)}` : 'Closed');
  const lines: { from: number; to: number; text: string }[] = [];
  for (const h of [...hours].sort((a, b) => a.day - b.day)) {
    const last = lines.at(-1);
    if (last && last.text === label(h) && last.to === h.day - 1) last.to = h.day;
    else lines.push({ from: h.day, to: h.day, text: label(h) });
  }
  return lines.map(l => `${WEEKDAYS[l.from]}${l.to > l.from ? ` – ${WEEKDAYS[l.to]}` : ''}: ${l.text}`);
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
