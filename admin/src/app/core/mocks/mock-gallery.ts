import { CATALOG_EDIT_ROLES } from '../constants/app.constants';
import { GalleryBulkAction, GalleryData, GalleryPhoto, GalleryPhotoDraft } from '../models/gallery.model';
import { MockError, MockRequest, NO_ROUTE, StoredCategory, db, reorderSubset, requireRole, route, save } from './mock-db';

/** Gallery photos and their categories (Content › Gallery). Photos are kept in display order. */
export function handleGallery(r: MockRequest): unknown {
  let m: string[] | null;
  if (r.method !== 'GET' && /^\/gallery\b/.test(r.path)) requireRole(r, CATALOG_EDIT_ROLES);
  if ((m = route(r, 'GET', /^\/gallery$/))) return galleryData();
  if ((m = route(r, 'POST', /^\/gallery$/))) return add(r.body);
  if ((m = route(r, 'PUT', /^\/gallery\/order$/))) return reorder(r.body.ids);
  if ((m = route(r, 'POST', /^\/gallery\/bulk$/))) return bulk(r.body);
  if ((m = route(r, 'PUT', /^\/gallery\/categories$/))) return saveCategories(r.body.categories);
  if ((m = route(r, 'PUT', /^\/gallery\/([^/]+)$/))) return update(find(m[0]), r.body);
  return NO_ROUTE;
}

export function galleryData(): GalleryData {
  const { gallery, galleryCategories } = db();
  return {
    categories: galleryCategories.map(c => ({ ...c, photoCount: gallery.filter(p => p.categoryId === c.id).length })),
    photos: gallery,
  };
}

function find(id: string): GalleryPhoto {
  const p = db().gallery.find(x => x.id === id);
  if (!p) throw new MockError(404, 'Photo not found.');
  return p;
}

function checkCategory(id: string): void {
  if (!db().galleryCategories.some(c => c.id === id)) throw new MockError(400, 'Pick a category.');
}

/** New photos go first and start hidden, so they can be captioned before customers see them. */
function add(body: Pick<GalleryPhotoDraft, 'imageUrl' | 'caption' | 'categoryId'>): GalleryPhoto {
  if (!body.imageUrl) throw new MockError(400, 'Upload a photo first.');
  checkCategory(body.categoryId);
  const photo: GalleryPhoto = {
    id: `ph-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, imageUrl: body.imageUrl,
    caption: body.caption?.trim() ?? '', categoryId: body.categoryId, pet: '', visible: false,
  };
  db().gallery.unshift(photo);
  save();
  return photo;
}

function update(p: GalleryPhoto, body: GalleryPhotoDraft): GalleryPhoto {
  checkCategory(body.categoryId);
  const caption = body.caption?.trim() ?? '';
  if (body.visible && !caption) throw new MockError(400, 'Add a caption before showing the photo in the app.');
  Object.assign(p, { caption, categoryId: body.categoryId, pet: body.pet?.trim() ?? '', visible: !!body.visible });
  save();
  return p;
}

function bulk(body: GalleryBulkAction): GalleryData {
  const photos = body.ids.map(find);
  if (body.action === 'delete') {
    db().gallery = db().gallery.filter(p => !photos.includes(p));
  } else if (body.action === 'move') {
    checkCategory(body.categoryId);
    photos.forEach(p => (p.categoryId = body.categoryId));
  } else {
    if (body.action === 'show' && photos.some(p => !p.caption)) throw new MockError(400, 'Add a caption to each photo before showing it in the app.');
    photos.forEach(p => (p.visible = body.action === 'show'));
  }
  save();
  return galleryData();
}

function reorder(ids: string[]): GalleryData {
  db().gallery = reorderSubset(db().gallery, ids);
  save();
  return galleryData();
}

/** Replaces the category list. A category can only go once it has no photos. */
function saveCategories(list: { id?: string; name: string }[]): GalleryData {
  const names = list.map(c => c.name?.trim() ?? '');
  if (names.some(n => !n)) throw new MockError(400, 'Every category needs a name.');
  if (new Set(names.map(n => n.toLowerCase())).size !== names.length) throw new MockError(400, 'Two categories have the same name.');
  for (const old of db().galleryCategories) {
    const count = db().gallery.filter(p => p.categoryId === old.id).length;
    if (count && !list.some(c => c.id === old.id)) throw new MockError(409, `Move the ${count} photo${count === 1 ? '' : 's'} in ${old.name} to another category first.`);
  }
  db().galleryCategories = list.map((c, i): StoredCategory => ({ id: c.id || `gc-${Date.now().toString(36)}${i}`, name: names[i] }));
  save();
  return galleryData();
}
