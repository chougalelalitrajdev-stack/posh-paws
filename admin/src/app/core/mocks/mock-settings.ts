import { OWNER_ROLES, ROLE_LABELS, SETTINGS_ROLES } from '../constants/app.constants';
import { BusinessSettings, Closure, DayHours, Settings, SettingsSection } from '../models/settings.model';
import { StaffRole, TeamMember } from '../models/staff-user.model';
import { minutesOfDay, today } from '../utils/date.utils';
import { MockError, MockRequest, NO_ROUTE, StoredClosure, db, requireRole, requireStaff, route, save } from './mock-db';

/** Settings (Super Admin + Admin) and Team & roles (Super Admin). Every signed-in user can read the settings. */
export function handleSettings(r: MockRequest): unknown {
  let m: string[] | null;
  if ((m = route(r, 'GET', /^\/settings$/))) return settingsData();
  if (r.method !== 'GET' && /^\/settings\b/.test(r.path)) requireRole(r, SETTINGS_ROLES);
  if ((m = route(r, 'POST', /^\/settings\/closures$/))) return addClosure(r.body);
  if ((m = route(r, 'DELETE', /^\/settings\/closures\/([^/]+)$/))) return removeClosure(m[0]);
  if ((m = route(r, 'PUT', /^\/settings\/([^/]+)$/))) return saveSection(m[0] as SettingsSection, r.body);
  if (/^\/team\b/.test(r.path)) requireRole(r, OWNER_ROLES);
  if ((m = route(r, 'GET', /^\/team$/))) return db().staff;
  if ((m = route(r, 'POST', /^\/team$/))) return invite(r.body);
  if ((m = route(r, 'PUT', /^\/team\/([^/]+)$/))) return setRole(r, member(m[0]), r.body.role);
  if ((m = route(r, 'DELETE', /^\/team\/([^/]+)$/))) return removeMember(r, member(m[0]));
  return NO_ROUTE;
}

export function settingsData(): Settings {
  const s = db().settings;
  return { ...s, booking: { ...s.booking, closures: [...s.booking.closures].sort((a, b) => a.date.localeCompare(b.date)).map(withAffected) } };
}

// ── Booking rules, as the slot logic needs them ──────────────

/** Hours for a date (Monday = 0). */
export function dayHours(date: string): DayHours {
  const weekday = (new Date(`${date}T00:00:00`).getDay() + 6) % 7;
  return db().settings.booking.hours[weekday];
}

export function closureOn(date: string): StoredClosure | undefined {
  return db().settings.booking.closures.find(c => c.date === date);
}

/** Earliest opening and latest closing of the week, for the calendar grid. */
export function openingSpan(): { opens: string; closes: string } {
  const open = db().settings.booking.hours.filter(h => h.open);
  if (!open.length) return { opens: '09:00', closes: '19:00' };
  return { opens: open.map(h => h.opens).sort()[0], closes: open.map(h => h.closes).sort().at(-1)! };
}

function withAffected(c: StoredClosure): Closure {
  const from = c.closesAt ? minutesOfDay(c.closesAt) : 0;
  const affectedBookings = db().bookings.filter(b =>
    b.date === c.date && b.time && ['confirmed', 'awaiting_payment'].includes(b.stage) && minutesOfDay(b.time) + (b.service?.durationMinutes ?? 0) > from).length;
  return { ...c, affectedBookings };
}

// ── Sections ──────────────────────────────────────────────────

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const between = (v: number, min: number, max: number, message: string) => {
  if (!Number.isInteger(v) || v < min || v > max) throw new MockError(400, message);
  return v;
};

function saveSection(section: SettingsSection, body: any): Settings {
  const s = db().settings;
  switch (section) {
    case 'business': s.business = cleanBusiness(body); break;
    case 'booking': s.booking = { ...cleanBooking(body), closures: s.booking.closures }; break;
    case 'payments':
      s.payments = {
        ...s.payments,
        linkExpiryHours: between(body.linkExpiryHours, 1, 72, 'Links can last 1 to 72 hours.'),
        slotHoldPaise: between(body.slotHoldPaise, 100, 500_000, 'Enter a hold amount in whole rupees.'),
      };
      break;
    case 'notifications':
      if (!TIME.test(body.reminderTime ?? '')) throw new MockError(400, 'Pick a reminder time.');
      s.notifications = {
        reminderTime: body.reminderTime, unpaidNudgeHours: between(body.unpaidNudgeHours, 1, 48, 'Pick when to follow up unpaid links.'),
        staffAlerts: body.staffAlerts === 'everyone' ? 'everyone' : 'admins',
      };
      break;
    case 'app': {
      const bookButtonText = body.bookButtonText?.trim();
      if (!bookButtonText || bookButtonText.length > 20) throw new MockError(400, 'Keep the Book button text to 1–20 characters.');
      s.app = { bookButtonText, showPrices: !!body.showPrices };
      break;
    }
    default: throw new MockError(404, 'Not found.');
  }
  save();
  return settingsData();
}

function cleanBusiness(b: BusinessSettings): BusinessSettings {
  const name = b.name?.trim();
  if (!name) throw new MockError(400, 'Enter the business name.');
  if (b.email && !/^\S+@\S+\.\S+$/.test(b.email.trim())) throw new MockError(400, 'That email doesn’t look right.');
  const text = (v?: string) => v?.trim() ?? '';
  return { name, phone: text(b.phone), whatsapp: text(b.whatsapp), email: text(b.email), instagram: text(b.instagram), mapsLink: text(b.mapsLink), address: text(b.address) };
}

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function cleanBooking(body: Settings['booking']): Omit<Settings['booking'], 'closures'> {
  if (!Array.isArray(body.hours) || body.hours.length !== 7) throw new MockError(400, 'Send hours for all seven days.');
  const hours = body.hours.map((h, day): DayHours => {
    const name = DAY_NAMES[day];
    if (!h.open) return { day, open: false, opens: h.opens || '09:00', closes: h.closes || '19:00', breakFrom: null, breakTo: null };
    if (!TIME.test(h.opens) || !TIME.test(h.closes) || h.opens >= h.closes) throw new MockError(400, `${name}: closing time must be after opening time.`);
    const hasBreak = !!(h.breakFrom || h.breakTo);
    if (hasBreak && (!TIME.test(h.breakFrom ?? '') || !TIME.test(h.breakTo ?? '') || h.breakFrom! >= h.breakTo! || h.breakFrom! <= h.opens || h.breakTo! >= h.closes)) {
      throw new MockError(400, `${name}: the break must be inside opening hours.`);
    }
    return { day, open: true, opens: h.opens, closes: h.closes, breakFrom: hasBreak ? h.breakFrom : null, breakTo: hasBreak ? h.breakTo : null };
  });
  if (!hours.some(h => h.open)) throw new MockError(400, 'Open at least one day a week.');
  return {
    hours,
    slotStepMinutes: between(body.slotStepMinutes, 5, 120, 'Pick how often slots start.'),
    bufferMinutes: between(body.bufferMinutes, 0, 60, 'Pick a buffer of 0 to 60 minutes.'),
    bookAheadDays: between(body.bookAheadDays, 1, 365, 'Pick how far ahead bookings can be made.'),
    minNoticeMinutes: between(body.minNoticeMinutes, 0, 2880, 'Pick the minimum notice.'),
  };
}

function addClosure(body: Omit<Closure, 'id' | 'affectedBookings'>): Closure {
  const name = body.name?.trim();
  if (!body.date) throw new MockError(400, 'Pick a date.');
  if (body.date < today()) throw new MockError(400, 'Pick today or a later date.');
  if (!name) throw new MockError(400, 'Name the closure, e.g. Diwali.');
  if (body.closesAt && !TIME.test(body.closesAt)) throw new MockError(400, 'Pick the closing time.');
  if (closureOn(body.date)) throw new MockError(409, 'There is already a closure on that day.');
  const closure: StoredClosure = { id: `cl-${Date.now().toString(36)}`, date: body.date, name, closesAt: body.closesAt || null };
  db().settings.booking.closures.push(closure);
  save();
  return withAffected(closure);
}

function removeClosure(id: string): Settings {
  const closures = db().settings.booking.closures;
  if (!closures.some(c => c.id === id)) throw new MockError(404, 'Closure not found.');
  db().settings.booking.closures = closures.filter(c => c.id !== id);
  save();
  return settingsData();
}

// ── Team ──────────────────────────────────────────────────────

function member(id: string): TeamMember {
  const m = db().staff.find(x => x.id === id);
  if (!m) throw new MockError(404, 'Team member not found.');
  return m;
}

function checkRole(role: StaffRole): StaffRole {
  if (!(role in ROLE_LABELS)) throw new MockError(400, 'Pick a role.');
  return role;
}

function invite(body: { name: string; email: string; role: StaffRole }): TeamMember {
  const name = body.name?.trim();
  const email = body.email?.trim().toLowerCase();
  if (!name) throw new MockError(400, 'Enter their name.');
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) throw new MockError(400, 'Enter their email.');
  if (db().staff.some(s => s.email === email)) throw new MockError(409, 'Someone on the team already uses that email.');
  const m: TeamMember = { id: `st-${Date.now().toString(36)}`, name, email, role: checkRole(body.role), status: 'invited', lastSeenAt: null };
  db().staff.push(m);
  save();
  return m;
}

/** There is always at least one active Super Admin, and nobody changes their own role. */
function setRole(r: MockRequest, m: TeamMember, role: StaffRole): TeamMember {
  if (m.id === requireStaff(r).id) throw new MockError(409, 'You can’t change your own role. Ask another Super Admin.');
  checkRole(role);
  if (m.role === 'super_admin' && role !== 'super_admin' && !otherOwner(m)) throw new MockError(409, 'Keep at least one Super Admin.');
  m.role = role;
  save();
  return m;
}

function removeMember(r: MockRequest, m: TeamMember): object {
  if (m.id === requireStaff(r).id) throw new MockError(409, 'You can’t remove yourself.');
  if (m.role === 'super_admin' && !otherOwner(m)) throw new MockError(409, 'Keep at least one Super Admin.');
  db().staff = db().staff.filter(x => x !== m);
  save();
  return {};
}

const otherOwner = (m: TeamMember) => db().staff.some(s => s !== m && s.role === 'super_admin' && s.status === 'active');
