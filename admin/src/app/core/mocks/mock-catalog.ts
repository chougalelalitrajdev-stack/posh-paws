import { CATALOG_EDIT_ROLES, SETTINGS_ROLES } from '../constants/app.constants';
import { PetType, Service, ServiceCategory, ServiceDraft, Station, StationDraft } from '../models/catalog.model';
import { today } from '../utils/date.utils';
import { MockError, MockRequest, NO_ROUTE, STORAGE_LIMIT, StoredService, db, requireRole, route, save, storageUsed } from './mock-db';

const CATEGORIES: ServiceCategory[] = ['Bath', 'Haircut', 'Package', 'Add-on', 'Treatment'];
const MAX_DESCRIPTION = 140;

/** Services (Catalog › Services), stations, and photo uploads. */
export function handleCatalog(r: MockRequest): unknown {
  let m: string[] | null;
  if (r.method !== 'GET' && /^\/(services|uploads)\b/.test(r.path)) requireRole(r, CATALOG_EDIT_ROLES);
  if ((m = route(r, 'GET', /^\/services$/))) return ordered().map(withCounts);
  if ((m = route(r, 'POST', /^\/services$/))) return create(r.body);
  if ((m = route(r, 'PUT', /^\/services\/order$/))) return reorder(r.body.petType, r.body.ids);
  if ((m = route(r, 'PUT', /^\/services\/([^/]+)$/))) return update(find(m[0]), r.body);
  if ((m = route(r, 'POST', /^\/services\/([^/]+)\/archive$/))) return setArchived(find(m[0]), true);
  if ((m = route(r, 'POST', /^\/services\/([^/]+)\/restore$/))) return setArchived(find(m[0]), false);
  if ((m = route(r, 'GET', /^\/stations$/))) return db().stations;
  if (r.method !== 'GET' && /^\/stations\b/.test(r.path)) requireRole(r, SETTINGS_ROLES); // shop setup: Admin and Super Admin
  if ((m = route(r, 'POST', /^\/stations$/))) return createStation(r.body);
  if ((m = route(r, 'PUT', /^\/stations\/([^/]+)$/))) return updateStation(station(m[0]), r.body);
  if ((m = route(r, 'DELETE', /^\/stations\/([^/]+)$/))) return removeStation(station(m[0]));
  if ((m = route(r, 'POST', /^\/uploads$/))) return upload(r.body);
  return NO_ROUTE;
}

function ordered(): StoredService[] {
  return [...db().services].sort((a, b) => a.petType.localeCompare(b.petType) || a.sortOrder - b.sortOrder);
}

function find(id: string): StoredService {
  const s = db().services.find(x => x.id === id);
  if (!s) throw new MockError(404, 'Service not found.');
  return s;
}

function withCounts(s: StoredService): Service {
  const t = today();
  const upcomingBookings = db().bookings.filter(b =>
    b.service?.id === s.id && b.date && b.date >= t && (b.stage === 'confirmed' || b.stage === 'awaiting_payment')).length;
  return { ...s, upcomingBookings };
}

function clean(body: ServiceDraft): ServiceDraft {
  const name = body.name?.trim();
  if (!name) throw new MockError(400, 'Enter a name.');
  if (body.petType !== 'dog' && body.petType !== 'cat') throw new MockError(400, 'Is it for dogs or cats?');
  if (!CATEGORIES.includes(body.category)) throw new MockError(400, 'Pick a category.');
  if (!Number.isInteger(body.pricePaise) || body.pricePaise <= 0) throw new MockError(400, 'Enter a price in whole rupees.');
  if (!body.durationMinutes || body.durationMinutes < 5) throw new MockError(400, 'Pick a duration.');
  const description = body.description?.trim() ?? '';
  if (description.length > MAX_DESCRIPTION) throw new MockError(400, `Keep the description under ${MAX_DESCRIPTION} characters.`);
  return { name, petType: body.petType, category: body.category, description, durationMinutes: body.durationMinutes, pricePaise: body.pricePaise, imageUrl: body.imageUrl || undefined, visible: !!body.visible };
}

function create(body: ServiceDraft): Service {
  const draft = clean(body);
  const last = Math.max(-1, ...db().services.filter(s => s.petType === draft.petType && !s.archived).map(s => s.sortOrder));
  const service: StoredService = { ...draft, id: `${draft.petType}-${Date.now().toString(36)}`, archived: false, sortOrder: last + 1 };
  db().services.push(service);
  save();
  return withCounts(service);
}

function update(s: StoredService, body: ServiceDraft): Service {
  const draft = clean(body);
  if (draft.petType !== s.petType) {
    // Moving between dogs and cats puts it last in the new list.
    s.sortOrder = Math.max(-1, ...db().services.filter(x => x.petType === draft.petType).map(x => x.sortOrder)) + 1;
  }
  Object.assign(s, { imageUrl: undefined }, draft);
  save();
  return withCounts(s);
}

function reorder(petType: PetType, ids: string[]): Service[] {
  ids.forEach((id, index) => {
    const s = db().services.find(x => x.id === id && x.petType === petType);
    if (s) s.sortOrder = index;
  });
  save();
  return ordered().map(withCounts);
}

function setArchived(s: StoredService, archived: boolean): Service {
  s.archived = archived;
  if (archived) s.visible = false;
  save();
  return withCounts(s);
}

/** Pretends to store the photo: the browser already resized it, so the data URL is the "file URL". */
async function upload(body: FormData): Promise<{ url: string }> {
  const file = body instanceof FormData ? body.get('file') : null;
  if (!(file instanceof Blob)) throw new MockError(400, 'Choose an image.');
  const url = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new MockError(400, 'Could not read that image.'));
    reader.readAsDataURL(file);
  });
  if (storageUsed() + url.length > STORAGE_LIMIT) {
    throw new MockError(507, 'Photo storage for this demo is full. Delete photos you don’t need, then try again. Real photo storage removes this limit.');
  }
  return { url };
}

// ── Stations (Availability › Stations) ────────────────────────

function station(id: string): Station {
  const st = db().stations.find(x => x.id === id);
  if (!st) throw new MockError(404, 'Station not found.');
  return st;
}

function cleanStation(body: StationDraft, id?: string): StationDraft {
  const name = body?.name?.trim();
  if (!name) throw new MockError(400, 'Name the station, e.g. Table 3 or Cat corner.');
  if (db().stations.some(st => st.id !== id && st.name.toLowerCase() === name.toLowerCase())) throw new MockError(409, `There's already a station called ${name}.`);
  if (!['all', 'dogs', 'cats', 'some'].includes(body.canDo)) throw new MockError(400, 'Pick what the station can do.');
  const serviceIds = body.canDo === 'some' ? [...new Set(body.serviceIds ?? [])].filter(sid => db().services.some(sv => sv.id === sid)) : [];
  if (body.canDo === 'some' && !serviceIds.length) throw new MockError(400, 'Pick at least one service it can do.');
  return { name, active: body.active !== false, canDo: body.canDo, serviceIds };
}

/** Keep at least one station in use, or nobody could book. */
function keepOneInUse(changing: string, active: boolean): void {
  if (!active && !db().stations.some(st => st.id !== changing && st.active)) throw new MockError(409, 'Keep at least one station in use.');
}

function createStation(body: StationDraft): Station {
  const st: Station = { id: `st-${Date.now().toString(36)}`, ...cleanStation(body) };
  db().stations.push(st);
  save();
  return st;
}

function updateStation(st: Station, body: StationDraft): Station {
  const draft = cleanStation(body, st.id);
  keepOneInUse(st.id, draft.active);
  // Bookings already on the station stay, even if it's switched off or can no longer do their service.
  Object.assign(st, draft);
  save();
  return st;
}

/** Only a station with no upcoming bookings can go; otherwise switch it off. */
function removeStation(st: Station): object {
  keepOneInUse(st.id, false);
  const upcoming = db().bookings.filter(b => b.stationId === st.id && b.date && b.date >= today() && ['awaiting_payment', 'confirmed'].includes(b.stage)).length;
  if (upcoming) throw new MockError(409, `${upcoming} upcoming booking${upcoming === 1 ? ' is' : 's are'} on ${st.name}. Move ${upcoming === 1 ? 'it' : 'them'} first, or switch the station off instead.`);
  db().stations = db().stations.filter(x => x.id !== st.id);
  db().blocks = db().blocks.filter(b => b.stationId !== st.id);
  save();
  return {};
}
