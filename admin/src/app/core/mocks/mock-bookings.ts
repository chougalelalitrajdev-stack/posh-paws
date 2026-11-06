import { SETTINGS_ROLES } from '../constants/app.constants';
import { PAYMENT_METHODS, STAGES } from '../constants/status.constants';
import { ActivityEntry, AmountType, Booking, BookingDetails, BookingStage, NewShopPayment, QuoteRequest, StageCounts } from '../models/booking.model';
import { BoardSlot, CalendarData, DayAvailability, NewTimeBlock, SlotBoard, SlotChanges, TimeBlock, WeekBoard, WeekSlot } from '../models/calendar.model';
import { DayHours } from '../models/settings.model';
import { Paged } from '../models/paged.model';
import { addDays, dateRange, minutesOfDay, shortDate, slotStart, timeFromMinutes, today } from '../utils/date.utils';
import { formatInr } from '../utils/money.utils';
import { STATIONS } from './mock-data';
import { closureOn, dayHours, openingSpan } from './mock-settings';
import { MockError, MockRequest, NO_ROUTE, db, requireRole, requireStaff, route, save } from './mock-db';
import { settleMoney } from './mock-money';
import { addPayment, quoteBill, refundAdvanceOnCancel, release, reserve } from './mock-pricing';

/** Stages that hold a slot on the calendar. */
const HOLDS_SLOT: BookingStage[] = ['awaiting_payment', 'confirmed', 'completed'];

export function handleBookings(r: MockRequest): unknown {
  let m: string[] | null;

  if ((m = route(r, 'GET', /^\/bookings$/))) return list(r);
  if ((m = route(r, 'GET', /^\/bookings\/counts$/))) return counts();
  if ((m = route(r, 'GET', /^\/calendar$/))) return calendar(r.param('from') || today(), Number(r.param('days') || 1));
  if ((m = route(r, 'GET', /^\/slots$/))) return slots(r.param('serviceId'), r.param('from') || today(), Number(r.param('days') || 7), r.param('excludeBookingId'));
  if ((m = route(r, 'GET', /^\/slot-board\/week$/))) return weekBoard();
  if ((m = route(r, 'PUT', /^\/slot-board\/week\/([0-6])$/))) {
    requireRole(r, SETTINGS_ROLES); // the usual week is the business's hours: Admin and Super Admin
    return setWeekSlot(Number(m[0]), r.body);
  }
  if ((m = route(r, 'GET', /^\/slot-board$/))) return slotBoard(r.param('date') || today());
  if ((m = route(r, 'PUT', /^\/slot-board\/(\d{4}-\d{2}-\d{2})$/))) return setSlot(m[0], r.body);
  if ((m = route(r, 'POST', /^\/blocks$/))) return addBlock(r.body);
  if ((m = route(r, 'DELETE', /^\/blocks\/([^/]+)$/))) return removeBlock(m[0]);

  if ((m = route(r, 'POST', /^\/bookings\/quote$/))) return quote(r.body);
  if ((m = route(r, 'GET', /^\/bookings\/([^/]+)$/))) return find(m[0]);
  if ((m = route(r, 'POST', /^\/bookings$/))) return saveDetails(r, null, r.body);
  if ((m = route(r, 'PUT', /^\/bookings\/([^/]+)$/))) return saveDetails(r, m[0], r.body);

  const action = route(r, 'POST', /^\/bookings\/([^/]+)\/([a-z-]+)$/);
  if (action) {
    const [id, name] = action;
    const b = find(id);
    const by = requireStaff(r).name;
    switch (name) {
      case 'confirm': return confirm(b, by);
      case 'payment-link': return paymentLink(b, r.body.amountType, by);
      case 'payments': return recordPayment(b, r.body, by);
      case 'demo-pay': return payLink(b);
      case 'reschedule': return reschedule(b, r.body.date, r.body.time, by);
      case 'cancel': return cancel(b, r.body.reason, by);
      case 'complete': return setStage(b, ['confirmed'], 'completed', 'Marked completed', by);
      case 'no-show': return setStage(b, ['confirmed'], 'no_show', 'Marked as no-show', by);
      case 'notes': return addNote(b, r.body.text, by);
    }
  }
  return NO_ROUTE;
}

// ── Reading ───────────────────────────────────────────────────

/** The bill a phone booking would have (no advance), without saving anything. */
function quote(body: QuoteRequest) {
  if (!db().customers.some(c => c.id === body.customerId)) throw new MockError(404, 'Customer not found.');
  return quoteBill(body.customerId, body.serviceId, body.offerCode, false);
}

export function find(id: string): Booking {
  const b = db().bookings.find(x => x.id === id);
  if (!b) throw new MockError(404, 'Booking not found.');
  return b;
}

function list(r: MockRequest): Paged<Booking> {
  const stages = r.param('stage') ? r.param('stage').split(',') : [];
  const range = r.param('range') || 'any';
  const page = Math.max(1, Number(r.param('page') || 1));
  const pageSize = Number(r.param('pageSize') || 10);
  const t = today();
  const inRange = (b: Booking) => {
    if (!b.date || range === 'any') return true; // drafts may have no date yet
    if (range === 'today') return b.date === t;
    if (range === 'next7') return b.date >= t && b.date <= addDays(t, 6);
    return b.date >= addDays(t, -30) && b.date <= t; // last30
  };

  const items = db().bookings
    .filter(b => !stages.length || stages.includes(b.stage))
    .filter(b => !r.param('customerId') || b.customer.id === r.param('customerId'))
    .filter(inRange)
    .filter(b => !r.param('serviceId') || b.service?.id === r.param('serviceId'))
    .filter(b => !r.param('petType') || b.pet?.type === r.param('petType'))
    .filter(b => !r.param('paymentStatus') || b.paymentStatus === r.param('paymentStatus'))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return { items: items.slice((page - 1) * pageSize, page * pageSize), total: items.length, page, pageSize };
}

function counts(): StageCounts {
  const result = Object.fromEntries(Object.keys(STAGES).map(s => [s, 0])) as StageCounts;
  for (const b of db().bookings) result[b.stage]++;
  return result;
}

function calendar(from: string, days: number): CalendarData {
  const dates = dateRange(from, Math.min(days, 14));
  return {
    stations: STATIONS,
    bookings: db().bookings.filter(b => b.date && dates.includes(b.date) && HOLDS_SLOT.includes(b.stage)),
    blocks: dates.flatMap(blocksOn),
    ...openingSpan(),
  };
}

// ── Availability ──────────────────────────────────────────────

/** Breaks and closures (from Settings) on every station, plus any blocks staff added. */
function blocksOn(date: string): TimeBlock[] {
  const hours = dayHours(date);
  const closure = closureOn(date);
  const span = openingSpan();
  const fixed = (key: string, from: string, to: string, reason: string) => STATIONS.map(st => ({
    id: `${key}-${date}-${st.id}`, stationId: st.id, date, time: from, durationMinutes: minutesOfDay(to) - minutesOfDay(from), reason, fixed: true,
  }));
  let blocks: TimeBlock[];
  if (!hours.open || (closure && !closure.closesAt)) blocks = fixed('closed', span.opens, span.closes, closure ? `Closed · ${closure.name}` : 'Closed');
  else {
    blocks = hours.breakFrom && hours.breakTo ? fixed('break', hours.breakFrom, hours.breakTo, 'Break') : [];
    if (closure?.closesAt && closure.closesAt < hours.closes) blocks.push(...fixed('closed', closure.closesAt, hours.closes, `Closed · ${closure.name}`));
  }
  return [...blocks, ...db().blocks.filter(b => b.date === date)];
}

/** Busy [start, end) minutes on one station; bookings keep a cleaning buffer after them. `ignoreFixed` skips breaks and closures. */
function busy(date: string, stationId: string, excludeId?: string, ignoreFixed = false): [number, number][] {
  const booked = db().bookings
    .filter(b => b.id !== excludeId && b.date === date && b.stationId === stationId && b.time && b.service && HOLDS_SLOT.includes(b.stage))
    .map(b => [minutesOfDay(b.time!), minutesOfDay(b.time!) + b.service!.durationMinutes + rules().bufferMinutes] as [number, number]);
  const blocked = blocksOn(date)
    .filter(b => b.stationId === stationId && !(ignoreFixed && b.fixed))
    .map(b => [minutesOfDay(b.time), minutesOfDay(b.time) + b.durationMinutes] as [number, number]);
  return [...booked, ...blocked];
}

const rules = () => db().settings.booking;

/**
 * The first station free for the whole appointment, or null. Follows Settings › Booking & availability
 * (opening hours, breaks, closures, buffer, minimum notice, how far ahead) and the slot board.
 */
export function freeStation(date: string, time: string, durationMinutes: number, excludeId?: string): string | null {
  const { closed, extra } = changesOn(date);
  if (closed.includes(time)) return null;
  // Staff opened extra times on purpose, so opening hours, breaks and closures don't apply to them.
  const isExtra = extra.includes(time);
  const hours = dayHours(date);
  const start = minutesOfDay(time);
  const end = start + durationMinutes;
  if (!isExtra && (!hours.open || start < minutesOfDay(hours.opens) || end > minutesOfDay(hours.closes))) return null;
  if (slotStart(date, time).getTime() - Date.now() < rules().minNoticeMinutes * 60_000) return null;
  if (date > addDays(today(), rules().bookAheadDays)) return null;
  return freeStations(date, start, end, isExtra, excludeId)[0] ?? null;
}

/** Stations with [start, end) and the cleaning buffer free. */
function freeStations(date: string, start: number, end: number, ignoreFixed: boolean, excludeId?: string): string[] {
  const buffer = rules().bufferMinutes;
  return STATIONS.filter(st => busy(date, st.id, excludeId, ignoreFixed).every(([from, to]) => end + buffer <= from || start >= to)).map(st => st.id);
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DAY_NAMES = ['Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays', 'Sundays'];
const add = (list: string[], t: string) => (list.includes(t) ? list : [...list, t].sort());
const without = (list: string[], t: string) => list.filter(x => x !== t);

/** Every slot step inside these hours where a visit this long fits. */
function startsIn(hours: DayHours, durationMinutes: number): string[] {
  const starts: string[] = [];
  if (!hours.open) return starts;
  for (let t = minutesOfDay(hours.opens); t + durationMinutes <= minutesOfDay(hours.closes); t += rules().slotStepMinutes) starts.push(timeFromMinutes(t));
  return starts;
}

/** The usual start times on a date (none when closed all day). */
function usualStarts(date: string, durationMinutes: number): string[] {
  const closure = closureOn(date);
  return closure && !closure.closesAt ? [] : startsIn(dayHours(date), durationMinutes);
}

/** The usual start times minus the ones staff closed, plus the extra ones they opened. */
function slots(serviceId: string, from: string, days: number, excludeId?: string): DayAvailability[] {
  const service = db().services.find(s => s.id === serviceId);
  if (!service) throw new MockError(404, 'Service not found.');
  return dateRange(from, Math.min(days, 14)).map(date => {
    const { closed, extra } = changesOn(date);
    const starts = [...new Set([...usualStarts(date, service.durationMinutes).filter(t => !closed.includes(t)), ...extra])].sort();
    return { date, slots: starts.map(time => ({ time, available: freeStation(date, time, service.durationMinutes, excludeId) !== null })) };
  });
}

// ── Start times staff change: every week (Availability › Week) and on one day (› Day) ──
// Strongest first: a holiday, that day's changes, the weekly pattern, the opening hours.

function dayChanges(date: string): SlotChanges {
  return db().slotChanges.find(c => c.date === date) ?? { date, closed: [], extra: [] };
}

function keepDayChanges(c: SlotChanges): void {
  db().slotChanges = [...db().slotChanges.filter(x => x.date !== c.date), ...(c.closed.length || c.extra.length ? [c] : [])];
}

/**
 * Start times closed and opened on a date. A day's "extra" also reopens a time closed every week;
 * a holiday silences the weekly extra times after it closes (all of them when closed all day).
 */
function changesOn(date: string): { closed: string[]; extra: string[]; weeklyExtra: string[] } {
  const week = dayHours(date);
  const day = dayChanges(date);
  const closure = closureOn(date);
  const weeklyExtra = week.open ? week.extraStarts.filter(t => !closure || (!!closure.closesAt && t < closure.closesAt)) : [];
  return {
    closed: [...new Set([...week.closedStarts, ...day.closed])].filter(t => !day.extra.includes(t)),
    extra: [...new Set([...weeklyExtra, ...day.extra])].filter(t => !day.closed.includes(t)),
    weeklyExtra,
  };
}

function slotBoard(date: string): SlotBoard {
  const { closed, extra, weeklyExtra } = changesOn(date);
  const { day, ...hours } = dayHours(date);
  const closure = closureOn(date);
  const step = rules().slotStepMinutes;
  const usual = usualStarts(date, step);
  const fixedBlocks = blocksOn(date).filter(b => b.fixed && b.stationId === STATIONS[0].id);
  // Weekly extra times stay listed when closed for the day, so they can be opened again.
  const times = [...new Set([...usual, ...extra, ...weeklyExtra])].sort();
  const slot = (time: string): BoardSlot => {
    const start = minutesOfDay(time);
    const fixed = fixedBlocks.find(b => minutesOfDay(b.time) <= start && start < minutesOfDay(b.time) + b.durationMinutes);
    const opened = extra.includes(time);
    // A usual time that's bookable is just "open", even when reopened for the day after a weekly close.
    const isExtra = opened && !(usual.includes(time) && !fixed);
    const blocked = isExtra ? undefined : fixed;
    const past = slotStart(date, time).getTime() < Date.now();
    return {
      time, state: closed.includes(time) ? 'closed' : isExtra ? 'extra' : 'open',
      freeStations: past || blocked ? 0 : freeStations(date, start, start + step, opened).length,
      blockedBy: past ? 'Past' : blocked?.reason ?? null,
      weekly: hours.closedStarts.includes(time) ? 'closed' : hours.extraStarts.includes(time) ? 'extra' : null,
    };
  };
  return {
    date, hours, closure: closure ? { name: closure.name, closesAt: closure.closesAt } : null,
    stepMinutes: step, stations: STATIONS.length, slots: times.map(slot),
  };
}

/** Open or close one start time on one day. Closing stops new bookings starting then; bookings already made stay. */
function setSlot(date: string, body: { time?: string; open?: boolean }): SlotBoard {
  const time = body?.time ?? '';
  if (!TIME.test(time)) throw new MockError(400, 'Enter a time like 18:30.');
  if (date > addDays(today(), rules().bookAheadDays)) throw new MockError(400, `Bookings open ${rules().bookAheadDays} days ahead; change this day nearer the time.`);
  if (slotStart(date, time).getTime() < Date.now()) throw new MockError(400, 'That time has passed.');
  const isOpen = () => slotBoard(date).slots.some(s => s.time === time && s.state !== 'closed' && !s.blockedBy);
  const changes = dayChanges(date);
  if (body.open) {
    // Undo a close for the day; if it's still shut (closed every week, in the break, after hours), open it for the day.
    changes.closed = without(changes.closed, time);
    keepDayChanges(changes);
    if (!isOpen()) keepDayChanges({ ...changes, extra: add(changes.extra, time) });
  } else {
    if (!isOpen()) throw new MockError(404, 'That isn’t an open start time on this day.');
    changes.extra = without(changes.extra, time);
    keepDayChanges(changes);
    if (isOpen()) keepDayChanges({ ...changes, closed: add(changes.closed, time) });
  }
  save();
  return slotBoard(date);
}

/** The usual week: each weekday's start times with what's closed or extra every week. */
function weekBoard(): WeekBoard {
  const step = rules().slotStepMinutes;
  return {
    stepMinutes: step,
    days: db().settings.booking.hours.map(h => {
      const extras = h.open ? h.extraStarts : [];
      const inBreak = (t: string) => !!h.breakFrom && !!h.breakTo && t >= h.breakFrom && t < h.breakTo;
      const slot = (time: string): WeekSlot => ({
        time, state: extras.includes(time) ? 'extra' : h.closedStarts.includes(time) ? 'closed' : inBreak(time) ? 'break' : 'open',
      });
      return { ...h, slots: [...new Set([...startsIn(h, step), ...extras])].sort().map(slot) };
    }),
  };
}

/** Close or open a start time every week on one weekday (0 = Monday). Opening a break or after-hours time makes it a weekly extra. */
function setWeekSlot(weekday: number, body: { time?: string; open?: boolean }): WeekBoard {
  const time = body?.time ?? '';
  if (!TIME.test(time)) throw new MockError(400, 'Enter a time like 18:30.');
  const h = db().settings.booking.hours[weekday];
  if (!h.open) throw new MockError(409, `${DAY_NAMES[weekday]} are closed. Open the day in the hours below first.`);
  const inBreak = !!h.breakFrom && !!h.breakTo && time >= h.breakFrom && time < h.breakTo;
  const usual = startsIn(h, rules().slotStepMinutes).includes(time) && !inBreak;
  if (body.open) {
    h.closedStarts = without(h.closedStarts, time);
    if (!usual) h.extraStarts = add(h.extraStarts, time);
  } else if (h.extraStarts.includes(time)) {
    h.extraStarts = without(h.extraStarts, time);
  } else if (usual) {
    h.closedStarts = add(h.closedStarts, time);
  } else {
    throw new MockError(404, `That isn’t a start time on ${DAY_NAMES[weekday]}.`);
  }
  save();
  return weekBoard();
}

function addBlock(body: NewTimeBlock): TimeBlock {
  if (!STATIONS.some(s => s.id === body.stationId)) throw new MockError(400, 'Pick a station.');
  if (!body.durationMinutes || body.durationMinutes < 15) throw new MockError(400, 'Block at least 15 minutes.');
  const start = minutesOfDay(body.time);
  const clash = busy(body.date, body.stationId).some(([from, to]) => start < to && from < start + body.durationMinutes);
  if (clash) throw new MockError(409, 'That time overlaps a booking or another block on this station.');
  const block: TimeBlock = { ...body, reason: body.reason?.trim() || 'Blocked', id: `blk-${Date.now()}`, fixed: false };
  db().blocks.push(block);
  save();
  return block;
}

function removeBlock(id: string): object {
  const before = db().blocks.length;
  db().blocks = db().blocks.filter(b => b.id !== id);
  if (db().blocks.length === before) throw new MockError(404, "That block can't be removed.");
  save();
  return {};
}

// ── Changing bookings ─────────────────────────────────────────

function log(b: Booking, entry: Omit<ActivityEntry, 'at'>): void {
  b.activity.unshift({ at: new Date().toISOString(), ...entry });
}

function commit(b: Booking): Booking {
  save();
  return b;
}

/** Create a draft (id null) or update one with customer, pet, service and slot. */
function saveDetails(r: MockRequest, id: string | null, d: BookingDetails): Booking {
  const by = requireStaff(r).name;
  const customer = db().customers.find(c => c.id === d.customerId);
  if (!customer) throw new MockError(404, 'Customer not found.');
  const pet = customer.pets.find(p => p.id === d.petId);
  if (!pet) throw new MockError(400, 'Pick one of the customer’s pets.');
  const service = db().services.find(s => s.id === d.serviceId);
  if (!service) throw new MockError(400, 'Pick a service.');
  if (service.archived) throw new MockError(400, `${service.name} is archived. Pick another service.`);
  if (service.petType !== pet.type) throw new MockError(400, `${service.name} is for ${service.petType}s.`);
  if (d.date && d.time && changesOn(d.date).closed.includes(d.time)) throw new MockError(409, 'That start time is closed. Pick another time.');
  if (d.date && d.time && !freeStation(d.date, d.time, service.durationMinutes, id ?? undefined)) {
    throw new MockError(409, 'That slot was just taken. Pick another time.');
  }

  let b: Booking;
  if (id) {
    b = find(id);
    if (b.stage !== 'draft') throw new MockError(409, 'Only drafts can be edited here. Use Reschedule instead.');
  } else {
    b = {
      id: `PP-${db().nextId++}`, createdAt: new Date().toISOString(), source: 'phone', stage: 'draft', paymentStatus: 'unpaid',
      customer: { id: customer.id, name: customer.name, phone: customer.phone }, pet: null, service: null,
      date: null, time: null, stationId: null, bill: null, payments: [], paymentLink: null, bookedBy: by, activity: [],
    };
    db().bookings.push(b);
    log(b, { kind: 'created', title: 'Booking started by staff', by });
  }

  b.stage = 'draft';
  b.customer = { id: customer.id, name: customer.name, phone: customer.phone };
  b.pet = { id: pet.id, name: pet.name, type: pet.type, breed: pet.breed };
  b.service = { id: service.id, name: service.name, durationMinutes: service.durationMinutes };
  // Staff bookings (phone calls) take no advance.
  b.bill = quoteBill(customer.id, service.id, d.offerCode, false, b.id);
  b.offerCode = d.offerCode?.trim().toUpperCase() || null;
  settleMoney(b);
  b.date = d.date;
  b.time = d.time;
  b.bookedBy ??= by;
  log(b, { kind: 'details', title: 'Booking details saved', detail: `${service.name}${d.date ? ` · ${shortDate(d.date)} ${d.time}` : ' · slot not picked yet'}`, by });
  return commit(b);
}

/** A booking made by phone: confirmed straight away, nothing paid yet (the customer pays at the shop). */
function confirm(b: Booking, by: string): Booking {
  if (b.stage !== 'draft') throw new MockError(409, 'Only drafts can be confirmed.');
  if (!b.service || !b.date || !b.time) throw new MockError(400, 'Pick a service and a slot first.');
  const station = freeStation(b.date, b.time, b.service.durationMinutes, b.id);
  if (!station) throw new MockError(409, 'That slot was just taken. Pick another time.');
  // Prices are fixed now (a plan session or an offer may have changed since the draft).
  b.bill = quoteBill(b.customer.id, b.service.id, b.offerCode, false, b.id);
  b.stationId = station;
  b.stage = 'confirmed';
  b.paymentLink = null;
  reserve(b);
  settleMoney(b);
  const due = b.bill.totalPaise ? `${formatInr(b.bill.totalPaise)} to pay at the shop.` : 'Covered by the plan session; nothing to pay.';
  log(b, { kind: 'status', title: 'Booking confirmed', detail: due, by });
  return commit(b);
}

/**
 * Sends (or re-sends) a payment link. Before the booking is confirmed it asks for the advance (hold) or the
 * full amount, and holds the slot until it expires. After, it asks for the balance.
 */
function paymentLink(b: Booking, amountType: AmountType, by: string): Booking {
  if (!['draft', 'awaiting_payment', 'confirmed', 'completed'].includes(b.stage)) throw new MockError(409, 'This booking doesn’t need a payment link.');
  if (!b.service || !b.date || !b.time || !b.bill) throw new MockError(400, 'Pick a service and a slot first.');
  const before = ['draft', 'awaiting_payment'].includes(b.stage);
  let amountPaise: number;
  let type: AmountType = 'full';
  if (before) {
    const station = freeStation(b.date, b.time, b.service.durationMinutes, b.id);
    if (!station) throw new MockError(409, 'That slot was just taken. Pick another time.');
    if (b.stage !== 'awaiting_payment') b.bill = quoteBill(b.customer.id, b.service.id, b.offerCode, false, b.id);
    if (!b.bill.totalPaise) throw new MockError(409, 'Nothing to pay: the plan session covers it. Confirm the booking instead.');
    type = b.stage === 'awaiting_payment' && b.paymentLink ? b.paymentLink.amountType : amountType === 'hold' ? 'hold' : 'full';
    amountPaise = type === 'hold' ? Math.min(db().settings.payments.slotHoldPaise, b.bill.totalPaise) : b.bill.totalPaise;
    b.stationId = station;
    b.stage = 'awaiting_payment';
  } else {
    amountPaise = b.bill.balancePaise;
    if (!amountPaise) throw new MockError(409, 'Nothing left to pay on this booking.');
  }
  const resend = !!b.paymentLink;
  const sentAt = new Date();
  b.paymentLink = {
    amountType: type, amountPaise,
    url: `https://pay.poshpaws.in/l/${b.id}${resend ? `-${sentAt.getTime().toString(36)}` : ''}`,
    sentAt: sentAt.toISOString(),
    expiresAt: new Date(sentAt.getTime() + db().settings.payments.linkExpiryHours * 3_600_000).toISOString(),
  };
  settleMoney(b);
  log(b, { kind: 'payment', title: resend ? 'New payment link sent' : before ? 'Payment link sent on WhatsApp' : 'Balance link sent on WhatsApp', detail: formatInr(amountPaise), by });
  return commit(b);
}

/** Mock only: the customer pays the open link. Paying before the visit confirms the booking. */
function payLink(b: Booking): Booking {
  const link = b.paymentLink;
  if (!link) throw new MockError(409, 'There’s no open payment link.');
  const confirming = b.stage === 'awaiting_payment';
  b.paymentLink = null;
  addPayment(b, confirming ? 'advance' : 'balance', link.amountPaise, 'online');
  if (confirming) {
    b.stage = 'confirmed';
    reserve(b);
    settleMoney(b);
  }
  log(b, { kind: 'payment', title: 'Paid online', detail: `${formatInr(link.amountPaise)}${confirming ? ' · booking confirmed automatically' : ''}` });
  return commit(b);
}

/** Money taken at the shop (shop UPI QR, cash or card), up to the balance. Taking it before the visit confirms the booking. */
function recordPayment(b: Booking, body: NewShopPayment, by: string): Booking {
  if (!['awaiting_payment', 'confirmed', 'completed'].includes(b.stage) || !b.bill) throw new MockError(409, 'Only booked or completed bookings take payments.');
  if (!['upi_qr', 'cash', 'card'].includes(body.method)) throw new MockError(400, 'Pick how they paid: shop QR, cash or card.');
  const due = b.bill.balancePaise;
  if (!Number.isInteger(body.amountPaise) || body.amountPaise <= 0) throw new MockError(400, 'Enter the amount received.');
  if (body.amountPaise > due) throw new MockError(400, `The balance is ${formatInr(due)}. Enter that or less.`);
  const confirming = b.stage === 'awaiting_payment';
  if (body.complete) mustHaveStarted(b);
  addPayment(b, confirming ? 'advance' : 'balance', body.amountPaise, body.method, by);
  if (confirming) {
    b.stage = 'confirmed';
    b.paymentLink = null;
    reserve(b);
  } else if (b.paymentLink && !b.bill.balancePaise) {
    b.paymentLink = null; // the balance link isn't needed any more
  }
  settleMoney(b);
  const left = b.bill.balancePaise ? ` · ${formatInr(b.bill.balancePaise)} still due` : ' · paid in full';
  log(b, { kind: 'payment', title: 'Payment taken at the shop', detail: `${formatInr(body.amountPaise)} by ${PAYMENT_METHODS[body.method]}${left}`, by });
  // Checkout: the pet came and is going home, so the visit is done too.
  if (body.complete && b.stage === 'confirmed') return setStage(b, ['confirmed'], 'completed', 'Marked completed', by);
  return commit(b);
}

function reschedule(b: Booking, date: string, time: string, by: string): Booking {
  if (b.stage !== 'awaiting_payment' && b.stage !== 'confirmed') throw new MockError(409, 'Only upcoming bookings can be rescheduled.');
  const station = b.service ? freeStation(date, time, b.service.durationMinutes, b.id) : null;
  if (!station) throw new MockError(409, 'That slot was just taken. Pick another time.');
  const from = b.date && b.time ? `${shortDate(b.date)} ${b.time}` : 'no slot';
  b.date = date;
  b.time = time;
  b.stationId = station;
  log(b, { kind: 'details', title: 'Rescheduled', detail: `${from} → ${shortDate(date)} ${time}`, by });
  return commit(b);
}

/** Frees the slot and gives back the plan session and offer use. The advance follows the refund rule; other payments are refunded from Payments. */
function cancel(b: Booking, reason: string | undefined, by: string): Booking {
  if (!['draft', 'awaiting_payment', 'confirmed'].includes(b.stage)) throw new MockError(409, 'This booking can’t be cancelled.');
  if (b.stage === 'confirmed') release(b);
  b.stage = 'cancelled';
  b.paymentLink = null;
  const advance = refundAdvanceOnCancel(b);
  settleMoney(b);
  const other = b.payments.some(p => p.kind === 'balance' && !b.payments.some(r => r.refundOf === p.id)) ? 'Other payments can be refunded from Payments.' : '';
  log(b, { kind: 'status', title: 'Booking cancelled', detail: [reason?.trim(), advance, other].filter(Boolean).join(' '), by });
  return commit(b);
}

/** Completed and no-show are decided by staff once the appointment has started; nothing closes a visit by itself. */
function mustHaveStarted(b: Booking): void {
  if (!b.date || !b.time || slotStart(b.date, b.time).getTime() > Date.now()) {
    throw new MockError(409, 'This appointment hasn’t started yet. Mark it completed or a no-show once it has.');
  }
}

function setStage(b: Booking, from: BookingStage[], to: BookingStage, title: string, by: string): Booking {
  if (!from.includes(b.stage)) throw new MockError(409, `Only ${from.map(s => STAGES[s].label.toLowerCase()).join(' or ')} bookings can be changed this way.`);
  if (to === 'completed' || to === 'no_show') mustHaveStarted(b);
  b.stage = to;
  settleMoney(b); // a no-show owes nothing more; a kept advance stays paid
  const due = to === 'completed' && b.bill?.balancePaise ? `${formatInr(b.bill.balancePaise)} still to pay.` : undefined;
  log(b, { kind: 'status', title, ...(due && { detail: due }), by });
  return commit(b);
}

function addNote(b: Booking, text: string, by: string): Booking {
  if (!text?.trim()) throw new MockError(400, 'Write a note first.');
  log(b, { kind: 'note', title: 'Note', detail: text.trim(), by });
  return commit(b);
}
