import { PAYMENT_LINK_HOURS, SLOT_HOLD_PAISE } from '../constants/app.constants';
import { STAGES } from '../constants/status.constants';
import { ActivityEntry, AmountType, Booking, BookingDetails, BookingStage, CallOutcome, StageCounts } from '../models/booking.model';
import { CalendarData, DayAvailability, NewTimeBlock, TimeBlock } from '../models/calendar.model';
import { Paged } from '../models/paged.model';
import { addDays, dateRange, minutesOfDay, shortDate, timeFromMinutes, today } from '../utils/date.utils';
import { discounted } from '../utils/money.utils';
import { HOURS, SERVICES, STATIONS } from './mock-data';
import { MockError, MockRequest, NO_ROUTE, db, requireStaff, route, save } from './mock-db';
import { planOf } from './mock-subscriptions';

/** Stages that hold a slot on the calendar. */
const HOLDS_SLOT: BookingStage[] = ['awaiting_payment', 'confirmed', 'completed'];

export function handleBookings(r: MockRequest): unknown {
  let m: string[] | null;

  if ((m = route(r, 'GET', /^\/bookings$/))) return list(r);
  if ((m = route(r, 'GET', /^\/bookings\/counts$/))) return counts();
  if ((m = route(r, 'GET', /^\/calendar$/))) return calendar(r.param('from') || today(), Number(r.param('days') || 1));
  if ((m = route(r, 'GET', /^\/slots$/))) return slots(r.param('serviceId'), r.param('from') || today(), Number(r.param('days') || 7), r.param('excludeBookingId'));
  if ((m = route(r, 'POST', /^\/blocks$/))) return addBlock(r.body);
  if ((m = route(r, 'DELETE', /^\/blocks\/([^/]+)$/))) return removeBlock(m[0]);

  if ((m = route(r, 'GET', /^\/bookings\/([^/]+)$/))) return find(m[0]);
  if ((m = route(r, 'POST', /^\/bookings$/))) return saveDetails(r, null, r.body);
  if ((m = route(r, 'PUT', /^\/bookings\/([^/]+)$/))) return saveDetails(r, m[0], r.body);

  const action = route(r, 'POST', /^\/bookings\/([^/]+)\/([a-z-]+)$/);
  if (action) {
    const [id, name] = action;
    const b = find(id);
    const by = requireStaff(r).name;
    switch (name) {
      case 'call-outcome': return callOutcome(b, r.body.outcome, by);
      case 'payment-link': return paymentLink(b, r.body.amountType, by);
      case 'mark-paid': return markPaid(b, 'desk', by);
      case 'demo-pay': return markPaid(b, 'online', by);
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
    if (!b.date || range === 'any') return true; // requests and drafts have no date yet
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
    opens: HOURS.opens,
    closes: HOURS.closes,
  };
}

// ── Availability ──────────────────────────────────────────────

/** Lunch on every station plus any blocks staff added. */
function blocksOn(date: string): TimeBlock[] {
  const lunch = STATIONS.map(st => ({
    id: `lunch-${date}-${st.id}`, stationId: st.id, date, time: HOURS.lunch.time,
    durationMinutes: HOURS.lunch.durationMinutes, reason: 'Lunch', fixed: true,
  }));
  return [...lunch, ...db().blocks.filter(b => b.date === date)];
}

/** Busy [start, end) minutes on one station; bookings keep a cleaning buffer after them. */
function busy(date: string, stationId: string, excludeId?: string): [number, number][] {
  const booked = db().bookings
    .filter(b => b.id !== excludeId && b.date === date && b.stationId === stationId && b.time && b.service && HOLDS_SLOT.includes(b.stage))
    .map(b => [minutesOfDay(b.time!), minutesOfDay(b.time!) + b.service!.durationMinutes + HOURS.bufferMinutes] as [number, number]);
  const blocked = blocksOn(date)
    .filter(b => b.stationId === stationId)
    .map(b => [minutesOfDay(b.time), minutesOfDay(b.time) + b.durationMinutes] as [number, number]);
  return [...booked, ...blocked];
}

/** The first station free for the whole appointment, or null. */
export function freeStation(date: string, time: string, durationMinutes: number, excludeId?: string): string | null {
  const start = minutesOfDay(time);
  const end = start + durationMinutes;
  if (start < minutesOfDay(HOURS.opens) || end > minutesOfDay(HOURS.closes)) return null;
  if (date < today() || (date === today() && start < nowMinutes() + 30)) return null;
  const station = STATIONS.find(st => busy(date, st.id, excludeId).every(([from, to]) => end + HOURS.bufferMinutes <= from || start >= to));
  return station?.id ?? null;
}

function slots(serviceId: string, from: string, days: number, excludeId?: string): DayAvailability[] {
  const service = SERVICES.find(s => s.id === serviceId);
  if (!service) throw new MockError(404, 'Service not found.');
  const starts: string[] = [];
  for (let t = minutesOfDay(HOURS.opens); t + service.durationMinutes <= minutesOfDay(HOURS.closes); t += HOURS.step) starts.push(timeFromMinutes(t));
  return dateRange(from, Math.min(days, 14)).map(date => ({
    date,
    slots: starts.map(time => ({ time, available: freeStation(date, time, service.durationMinutes, excludeId) !== null })),
  }));
}

function nowMinutes(): number {
  const n = new Date();
  return n.getHours() * 60 + n.getMinutes();
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

/** Create a draft (id null) or update a request/draft with customer, pet, service and slot. */
function saveDetails(r: MockRequest, id: string | null, d: BookingDetails): Booking {
  const by = requireStaff(r).name;
  const customer = db().customers.find(c => c.id === d.customerId);
  if (!customer) throw new MockError(404, 'Customer not found.');
  const pet = customer.pets.find(p => p.id === d.petId);
  if (!pet) throw new MockError(400, 'Pick one of the customer’s pets.');
  const service = SERVICES.find(s => s.id === d.serviceId);
  if (!service) throw new MockError(400, 'Pick a service.');
  if (service.petType !== pet.type) throw new MockError(400, `${service.name} is for ${service.petType}s.`);
  if (d.date && d.time && !freeStation(d.date, d.time, service.durationMinutes, id ?? undefined)) {
    throw new MockError(409, 'That slot was just taken. Pick another time.');
  }

  let b: Booking;
  if (id) {
    b = find(id);
    if (b.stage !== 'request' && b.stage !== 'draft') throw new MockError(409, 'Only requests and drafts can be edited here. Use Reschedule instead.');
  } else {
    b = {
      id: `PP-${db().nextId++}`, createdAt: new Date().toISOString(), source: 'phone', stage: 'draft', paymentStatus: 'not_requested',
      customer: { id: customer.id, name: customer.name, phone: customer.phone }, pet: null, service: null,
      date: null, time: null, stationId: null, pricePaise: null, payment: null, bookedBy: by, activity: [],
    };
    db().bookings.push(b);
    log(b, { kind: 'request', title: 'Booking started by staff', by });
  }

  b.stage = 'draft';
  b.customer = { id: customer.id, name: customer.name, phone: customer.phone };
  b.pet = { id: pet.id, name: pet.name, type: pet.type, breed: pet.breed };
  b.service = { id: service.id, name: service.name, durationMinutes: service.durationMinutes };
  b.pricePaise = discounted(service.pricePaise, planOf(customer.id)?.discountPercent ?? 0);
  b.date = d.date;
  b.time = d.time;
  b.bookedBy ??= by;
  log(b, { kind: 'details', title: 'Booking details saved', detail: `${service.name}${d.date ? ` · ${shortDate(d.date)} ${d.time}` : ' · slot not picked yet'}`, by });
  return commit(b);
}

function callOutcome(b: Booking, outcome: CallOutcome, by: string): Booking {
  if (!['reached', 'no_answer', 'call_back_later'].includes(outcome)) throw new MockError(400, 'Pick a call outcome.');
  b.request = { ...b.request, callOutcome: outcome };
  log(b, { kind: 'call', title: `Call outcome: ${outcome.replace(/_/g, ' ')}`, by });
  return commit(b);
}

/** Sends (or re-sends) the payment link. The slot is held from now until the link expires. */
function paymentLink(b: Booking, amountType: AmountType, by: string): Booking {
  if (!['draft', 'request', 'awaiting_payment'].includes(b.stage)) throw new MockError(409, 'This booking doesn’t need a payment link.');
  if (!b.service || !b.date || !b.time || b.pricePaise === null) throw new MockError(400, 'Pick a service and a slot first.');
  const resend = b.stage === 'awaiting_payment';
  const station = freeStation(b.date, b.time, b.service.durationMinutes, b.id);
  if (!station) throw new MockError(409, 'That slot was just taken. Pick another time.');

  const type = resend ? b.payment!.amountType : amountType === 'hold' ? 'hold' : 'full';
  const sentAt = new Date();
  b.stationId = station;
  b.stage = 'awaiting_payment';
  b.paymentStatus = 'link_sent';
  b.payment = {
    amountType: type,
    amountPaise: type === 'hold' ? Math.min(SLOT_HOLD_PAISE, b.pricePaise) : b.pricePaise,
    link: `https://pay.poshpaws.in/l/${b.id}${resend ? `-${sentAt.getTime().toString(36)}` : ''}`,
    sentAt: sentAt.toISOString(),
    expiresAt: new Date(sentAt.getTime() + PAYMENT_LINK_HOURS * 3_600_000).toISOString(),
  };
  log(b, { kind: 'payment', title: resend ? 'New payment link sent' : 'Payment link sent on WhatsApp', by });
  return commit(b);
}

function markPaid(b: Booking, method: 'desk' | 'online', by: string): Booking {
  if (b.stage !== 'awaiting_payment' || !b.payment) throw new MockError(409, 'Only bookings awaiting payment can be marked paid.');
  b.stage = 'confirmed';
  b.paymentStatus = 'paid';
  b.payment = { ...b.payment, paidAt: new Date().toISOString(), method };
  log(b, method === 'desk'
    ? { kind: 'payment', title: 'Marked paid at the desk', detail: 'Booking confirmed.', by }
    : { kind: 'payment', title: 'Paid online', detail: 'Booking confirmed automatically.' });
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

function cancel(b: Booking, reason: string | undefined, by: string): Booking {
  if (!['request', 'draft', 'awaiting_payment', 'confirmed'].includes(b.stage)) throw new MockError(409, 'This booking can’t be cancelled.');
  const paid = b.paymentStatus === 'paid';
  b.stage = 'cancelled';
  if (b.paymentStatus === 'link_sent' || b.paymentStatus === 'failed') b.paymentStatus = 'not_requested';
  log(b, { kind: 'status', title: 'Booking cancelled', detail: [reason?.trim(), paid ? 'Refund from Payments.' : ''].filter(Boolean).join(' '), by });
  return commit(b);
}

function setStage(b: Booking, from: BookingStage[], to: BookingStage, title: string, by: string): Booking {
  if (!from.includes(b.stage)) throw new MockError(409, `Only ${from.map(s => STAGES[s].label.toLowerCase()).join(' or ')} bookings can be changed this way.`);
  b.stage = to;
  log(b, { kind: 'status', title, by });
  return commit(b);
}

function addNote(b: Booking, text: string, by: string): Booking {
  if (!text?.trim()) throw new MockError(400, 'Write a note first.');
  log(b, { kind: 'note', title: 'Note', detail: text.trim(), by });
  return commit(b);
}
