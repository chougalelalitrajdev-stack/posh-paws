import { Booking } from '../models/booking.model';
import { BANNER_PLACEMENTS } from '../constants/content.constants';
import { AttentionItem, DashboardSummary } from '../models/dashboard.model';
import { addDays, ageLabel, agoLabel, dateRange, minutesSince, parseIsoDate, toIsoDate, today } from '../utils/date.utils';
import { formatInr } from '../utils/money.utils';
import { STATIONS } from './mock-data';
import { bannerStatus } from './mock-banners';
import { subscriptionSummary } from './mock-subscriptions';
import { MockRequest, NO_ROUTE, db, route } from './mock-db';

export function handleDashboard(r: MockRequest): unknown {
  return route(r, 'GET', /^\/dashboard$/) ? summary() : NO_ROUTE;
}

function summary(): DashboardSummary {
  const all = db().bookings;
  const t = today();
  const now = new Date();
  const nowTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const subs = subscriptionSummary();
  const requests = all.filter(b => b.stage === 'request');
  const awaiting = all.filter(b => b.stage === 'awaiting_payment');
  const todays = all
    .filter(b => b.date === t && ['awaiting_payment', 'confirmed', 'completed'].includes(b.stage))
    .sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''));

  const week = dateRange(addDays(t, -6), 7);
  const paidOn = (b: Booking) => toIsoDate(new Date(b.payment!.paidAt!));
  const paidThisWeek = all.filter(b => b.payment?.paidAt && week.includes(paidOn(b)));

  return {
    openStations: STATIONS.length,
    requests: { count: requests.length, oldestAt: requests.map(b => b.createdAt).sort()[0] ?? null },
    awaitingPayment: {
      count: awaiting.length,
      outstandingPaise: awaiting.reduce((sum, b) => sum + (b.payment?.amountPaise ?? 0), 0),
      failed: awaiting.filter(b => b.paymentStatus === 'failed').length,
    },
    today: {
      count: todays.length,
      done: todays.filter(b => b.stage === 'completed').length,
      nextTime: todays.find(b => b.stage !== 'completed' && (b.time ?? '') >= nowTime)?.time ?? null,
    },
    renewalsThisWeek: subs.renewingSoon,
    attention: attention(all),
    schedule: todays,
    payments: {
      totalPaise: paidThisWeek.reduce((sum, b) => sum + (b.payment?.amountPaise ?? 0), 0),
      count: paidThisWeek.length,
      failed: all.filter(b => b.paymentStatus === 'failed').length,
      refunds: all.filter(b => b.paymentStatus === 'refunded').length,
      days: week.map(date => ({
        date,
        amountPaise: paidThisWeek.filter(b => paidOn(b) === date).reduce((sum, b) => sum + b.payment!.amountPaise, 0),
      })),
    },
    memberships: { active: subs.active, renewThisWeek: subs.renewingSoon, expired: subs.expiredThisMonth, plans: subs.byPlan },
    content: content(),
  };
}

/** What needs a person now, oldest first; content reminders last. */
function attention(all: Booking[]): AttentionItem[] {
  const pet = (b: Booking) => (b.pet ? `${b.pet.name}${b.pet.breed ? ` · ${b.pet.breed}` : ''}` : b.request?.petNote ?? 'Pet not on file');
  const items: AttentionItem[] = [];

  for (const b of all) {
    if (b.stage === 'request' && b.request?.callOutcome !== 'no_answer') {
      items.push({
        kind: 'request', at: b.createdAt, action: 'Start booking', link: '/bookings/new', queryParams: { from: b.id },
        title: `${b.customer.name} asked for a callback`,
        detail: `${pet(b)}${b.request?.interestedIn ? ` · interested in ${b.request.interestedIn}` : ''} · ${ageLabel(b.createdAt)} ago`,
      });
    } else if (b.stage === 'awaiting_payment' && b.paymentStatus === 'failed') {
      items.push({
        kind: 'failed', at: b.payment!.sentAt, action: 'Send new link', link: `/bookings/${b.id}`,
        title: `Payment failed for ${b.id}`,
        detail: `${b.customer.name} · ${formatInr(b.payment!.amountPaise)}`,
      });
    } else if (b.stage === 'awaiting_payment' && b.payment && minutesSince(b.payment.sentAt) > db().settings.notifications.unpaidNudgeHours * 60) {
      items.push({
        kind: 'unpaid', at: b.payment.sentAt, action: 'Resend', link: `/bookings/${b.id}`,
        title: 'Payment link not paid yet',
        detail: `${b.customer.name} · ${b.pet?.name} · sent ${ageLabel(b.payment.sentAt)} ago`,
      });
    } else if (b.stage === 'draft') {
      items.push({
        kind: 'draft', at: b.createdAt, action: 'Continue', link: '/bookings/new', queryParams: { from: b.id },
        title: 'Booking left unfinished',
        detail: `${b.customer.name} · ${b.pet?.name ?? 'no pet yet'} · ${b.date ? 'payment link not sent' : 'slot not picked yet'}`,
      });
    }
  }
  items.sort((a, b) => a.at.localeCompare(b.at));
  for (const b of shownBanners().filter(b => endsIn(b.endsOn) <= 3)) {
    items.push({ kind: 'content', at: new Date().toISOString(), action: 'Review', link: '/banners', title: `${b.title} banner ${endsLabel(b.endsOn!)}`, detail: `${placementLabel(b.placement)} · Banners` });
  }
  return items;
}

// ── Customer app content ──────────────────────────────────────

const placementLabel = (p: string) => BANNER_PLACEMENTS.find(x => x.value === p)?.label ?? p;
const endsIn = (endsOn: string | null) => (endsOn ? Math.round((parseIsoDate(endsOn).getTime() - parseIsoDate(today()).getTime()) / 86_400_000) : Infinity);
const endsLabel = (endsOn: string) => (endsIn(endsOn) === 0 ? 'ends today' : `ends in ${endsIn(endsOn)} day${endsIn(endsOn) === 1 ? '' : 's'}`);

/** The banner customers see in each placement: the first live one. */
function shownBanners() {
  return BANNER_PLACEMENTS.map(p => db().banners.find(b => b.placement === p.value && bannerStatus(b) === 'live')).filter(b => b !== undefined);
}

function content(): DashboardSummary['content'] {
  const rows: DashboardSummary['content'] = shownBanners().map(b => ({
    title: b.title, where: `${placementLabel(b.placement)} banner`,
    status: endsIn(b.endsOn) <= 3 ? endsLabel(b.endsOn!).replace(/^e/, 'E') : 'Live', tone: endsIn(b.endsOn) <= 3 ? 'warn' : 'success',
  }));
  const hidden = db().gallery.filter(p => !p.visible).length;
  if (hidden) rows.push({ title: `${hidden} photo${hidden === 1 ? '' : 's'} not shown yet`, where: 'Gallery', status: 'Hidden', tone: 'draft' });
  for (const page of db().pages.filter(p => p.draft)) {
    rows.push({ title: page.title, where: `Pages & FAQs · draft saved ${agoLabel(page.draftSavedAt!)}`, status: 'Draft', tone: 'draft' });
  }
  return rows.slice(0, 5);
}
