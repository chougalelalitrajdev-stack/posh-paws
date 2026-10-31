// Date/time helpers. Dates are local calendar days (YYYY-MM-DD) and times are 24h HH:mm,
// never UTC: toISOString() would show yesterday's date in India before 5:30 am.

const WEEKDAY = new Intl.DateTimeFormat('en-IN', { weekday: 'short' });
const MONTH = new Intl.DateTimeFormat('en-IN', { month: 'short' });
const LONG = new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
const DAY_MONTH = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' });
const MONTH_YEAR = new Intl.DateTimeFormat('en-IN', { month: 'short', year: 'numeric' });
const HM = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });

export function toIsoDate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(iso: string, days: number): string {
  const d = parseIsoDate(iso);
  d.setDate(d.getDate() + days);
  return toIsoDate(d);
}

export function today(): string {
  return toIsoDate(new Date());
}

/** `count` consecutive dates starting at `from`. */
export function dateRange(from: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => addDays(from, i));
}

export function minutesOfDay(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function timeFromMinutes(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

/** Local Date for a date + time pair. */
export function slotStart(date: string, time: string): Date {
  const d = parseIsoDate(date);
  d.setMinutes(minutesOfDay(time));
  return d;
}

/** "12:00–14:00" */
export function timeRange(time: string, durationMinutes: number): string {
  return `${time}–${timeFromMinutes(minutesOfDay(time) + durationMinutes)}`;
}

/** "Today", "Tomorrow" or "Thu 29 Oct". */
export function dayLabel(iso: string): string {
  if (iso === today()) return 'Today';
  if (iso === addDays(today(), 1)) return 'Tomorrow';
  return shortDate(iso);
}

/** "Thu 29 Oct" (no comma, as in the design) */
export function shortDate(iso: string): string {
  const d = parseIsoDate(iso);
  return `${WEEKDAY.format(d)} ${d.getDate()} ${MONTH.format(d)}`;
}

/** "Tuesday, 27 October" */
export function longDate(iso: string): string {
  return LONG.format(parseIsoDate(iso));
}

/** "Tue" */
export function weekday(iso: string): string {
  return WEEKDAY.format(parseIsoDate(iso));
}

/** "Mar 2024" */
export function monthYear(timestamp: string): string {
  return MONTH_YEAR.format(new Date(timestamp));
}

/** When something happened: "Today 09:12", "Yesterday 18:05", "Mon 18:05" this week, else "12 Oct". */
export function whenLabel(timestamp: string, now = new Date()): string {
  const d = new Date(timestamp);
  const days = Math.round((parseIsoDate(toIsoDate(now)).getTime() - parseIsoDate(toIsoDate(d)).getTime()) / 86_400_000);
  if (days === 0) return `Today ${HM.format(d)}`;
  if (days === 1) return `Yesterday ${HM.format(d)}`;
  if (days > 1 && days < 7) return `${WEEKDAY.format(d)} ${HM.format(d)}`;
  return DAY_MONTH.format(d);
}

/** How long ago: "4 min", "1 h 10 min", "3 days". */
export function ageLabel(timestamp: string, now = new Date()): string {
  const minutes = Math.max(0, Math.round((now.getTime() - new Date(timestamp).getTime()) / 60_000));
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 24 * 60) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m ? `${h} h ${m} min` : `${h} h`;
  }
  const days = Math.floor(minutes / (24 * 60));
  return `${days} day${days > 1 ? 's' : ''}`;
}

/** Time left until a moment: "21 h", "45 min". */
export function untilLabel(timestamp: string, now = new Date()): string {
  return ageLabel(now.toISOString(), new Date(timestamp));
}

/** Minutes between a timestamp and now. */
export function minutesSince(timestamp: string, now = new Date()): number {
  return (now.getTime() - new Date(timestamp).getTime()) / 60_000;
}

/** "Good morning" / "Good afternoon" / "Good evening". */
export function greeting(now = new Date()): string {
  const h = now.getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

/** "45 min", "1 h 30 min", "2 h" (admin design format). */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** A pet's age from its birth date: "8 mo", "1 yr", "4 yrs". */
export function petAge(birthDate?: string, now = new Date()): string {
  if (!birthDate) return '';
  const born = parseIsoDate(birthDate);
  const months = (now.getFullYear() - born.getFullYear()) * 12 + now.getMonth() - born.getMonth() - (now.getDate() < born.getDate() ? 1 : 0);
  if (months < 12) return `${Math.max(0, months)} mo`;
  const years = Math.floor(months / 12);
  return `${years} yr${years > 1 ? 's' : ''}`;
}
