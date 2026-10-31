import { CATALOG_EDIT_ROLES } from '../constants/app.constants';
import { PetType, Service, ServiceCategory, ServiceDraft } from '../models/catalog.model';
import { today } from '../utils/date.utils';
import { STATIONS } from './mock-data';
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
  if ((m = route(r, 'GET', /^\/stations$/))) return STATIONS;
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
