import { CATALOG_EDIT_ROLES } from '../constants/app.constants';
import { Offer, OfferDraft, OfferStatus } from '../models/offer.model';
import { today } from '../utils/date.utils';
import { MockError, MockRequest, NO_ROUTE, db, requireRole, route, save } from './mock-db';

export function handleOffers(r: MockRequest): unknown {
  let m: string[] | null;
  if (r.method !== 'GET' && /^\/offers\b/.test(r.path)) requireRole(r, CATALOG_EDIT_ROLES);
  if ((m = route(r, 'GET', /^\/offers$/))) return db().offers.map(withStatus).sort(byStatus);
  if ((m = route(r, 'POST', /^\/offers$/))) return create(r.body);
  if ((m = route(r, 'PUT', /^\/offers\/([^/]+)$/))) return update(find(m[0]), r.body);
  if ((m = route(r, 'POST', /^\/offers\/([^/]+)\/pause$/))) return setPaused(find(m[0]), true);
  if ((m = route(r, 'POST', /^\/offers\/([^/]+)\/resume$/))) return setPaused(find(m[0]), false);
  return NO_ROUTE;
}

const ORDER: OfferStatus[] = ['live', 'scheduled', 'paused', 'draft', 'used_up', 'expired'];
const byStatus = (a: Offer, b: Offer) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status) || b.startsOn.localeCompare(a.startsOn);

export function statusOf(o: Offer): OfferStatus {
  const t = today();
  if (o.draft) return 'draft';
  if (o.endsOn && o.endsOn < t) return 'expired';
  if (o.totalUses !== null && o.used >= o.totalUses) return 'used_up';
  if (o.paused) return 'paused';
  if (o.startsOn > t) return 'scheduled';
  return 'live';
}

function withStatus(o: Offer): Offer {
  return { ...o, status: statusOf(o) };
}

function find(id: string): Offer {
  const o = db().offers.find(x => x.id === id);
  if (!o) throw new MockError(404, 'Offer not found.');
  return o;
}

function clean(body: OfferDraft, id?: string): OfferDraft {
  const title = body.title?.trim();
  if (!title) throw new MockError(400, 'Enter a title.');
  if (body.discountType !== 'percent' && body.discountType !== 'flat') throw new MockError(400, 'Pick % or ₹ flat.');
  if (!Number.isInteger(body.value) || body.value <= 0) throw new MockError(400, 'Enter a discount value.');
  if (body.discountType === 'percent' && body.value > 100) throw new MockError(400, 'A percentage can’t be more than 100.');
  const code = body.code?.trim().toUpperCase() || null;
  if (code && !/^[A-Z0-9]{3,20}$/.test(code)) throw new MockError(400, 'Codes use 3–20 letters and numbers, no spaces.');
  if (code && db().offers.some(o => o.id !== id && o.code === code)) throw new MockError(409, `The code ${code} is already used by another offer.`);
  if (!body.startsOn) throw new MockError(400, 'Pick a start date.');
  if (body.endsOn && body.endsOn < body.startsOn) throw new MockError(400, 'The end date is before the start date.');
  if (body.appliesTo === 'some_services' && !body.serviceIds?.length) throw new MockError(400, 'Pick at least one service.');
  const limit = (v: number | null) => (v === null || v === undefined || Number.isNaN(v) ? null : Math.max(1, Math.floor(v)));
  return {
    title, discountType: body.discountType, value: body.value, code, appliesTo: body.appliesTo,
    serviceIds: body.appliesTo === 'some_services' ? body.serviceIds : [], startsOn: body.startsOn, endsOn: body.endsOn || null,
    totalUses: limit(body.totalUses), perCustomer: limit(body.perCustomer), newCustomersOnly: !!body.newCustomersOnly, draft: !!body.draft,
  };
}

function create(body: OfferDraft): Offer {
  const offer: Offer = { id: `off-${Date.now().toString(36)}`, ...clean(body), paused: false, used: 0, status: 'draft' };
  db().offers.push(offer);
  save();
  return withStatus(offer);
}

function update(o: Offer, body: OfferDraft): Offer {
  Object.assign(o, clean(body, o.id));
  save();
  return withStatus(o);
}

function setPaused(o: Offer, paused: boolean): Offer {
  if (o.draft) throw new MockError(409, 'Drafts aren’t running yet. Schedule the offer instead.');
  o.paused = paused;
  save();
  return withStatus(o);
}
