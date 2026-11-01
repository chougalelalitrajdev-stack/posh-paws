import { CATALOG_EDIT_ROLES } from '../constants/app.constants';
import { APP_LINKS, BANNER_PLACEMENTS, BANNER_TITLE_MAX } from '../constants/content.constants';
import { Banner, BannerDraft, BannerPlacement, BannerStatus } from '../models/banner.model';
import { today } from '../utils/date.utils';
import { MockError, MockRequest, NO_ROUTE, StoredBanner, db, reorderSubset, requireRole, route, save } from './mock-db';

/** Banners (Content › Banners). The list is in display order; the first live banner in each placement is shown. */
export function handleBanners(r: MockRequest): unknown {
  let m: string[] | null;
  if (r.method !== 'GET' && /^\/banners\b/.test(r.path)) requireRole(r, CATALOG_EDIT_ROLES);
  if ((m = route(r, 'GET', /^\/banners$/))) return db().banners.map(withStatus);
  if ((m = route(r, 'POST', /^\/banners$/))) return create(r.body);
  if ((m = route(r, 'PUT', /^\/banners\/order$/))) return reorder(r.body.placement, r.body.ids);
  if ((m = route(r, 'PUT', /^\/banners\/([^/]+)$/))) return update(find(m[0]), r.body);
  if ((m = route(r, 'POST', /^\/banners\/([^/]+)\/pause$/))) return setPaused(find(m[0]), true);
  if ((m = route(r, 'POST', /^\/banners\/([^/]+)\/resume$/))) return setPaused(find(m[0]), false);
  if ((m = route(r, 'DELETE', /^\/banners\/([^/]+)$/))) return remove(find(m[0]));
  return NO_ROUTE;
}

export function bannerStatus(b: StoredBanner): BannerStatus {
  const t = today();
  if (b.endsOn && b.endsOn < t) return 'ended';
  if (b.paused) return 'paused';
  if (b.startsOn > t) return 'scheduled';
  return 'live';
}

export function withStatus(b: StoredBanner): Banner {
  return { ...b, status: bannerStatus(b) };
}

function find(id: string): StoredBanner {
  const b = db().banners.find(x => x.id === id);
  if (!b) throw new MockError(404, 'Banner not found.');
  return b;
}

function clean(body: BannerDraft): BannerDraft {
  const title = body.title?.trim();
  if (!title) throw new MockError(400, 'Enter a title.');
  if (title.length > BANNER_TITLE_MAX) throw new MockError(400, `Keep the title to ${BANNER_TITLE_MAX} characters.`);
  if (!BANNER_PLACEMENTS.some(p => p.value === body.placement)) throw new MockError(400, 'Pick where the banner shows.');
  if (!APP_LINKS.some(l => l.value === body.link)) throw new MockError(400, 'Pick the page the button opens.');
  const buttonText = body.buttonText?.trim();
  if (!buttonText) throw new MockError(400, 'Enter the button text.');
  if (!body.startsOn) throw new MockError(400, 'Pick a start date.');
  if (body.endsOn && body.endsOn < body.startsOn) throw new MockError(400, 'The end date is before the start date.');
  return {
    placement: body.placement, title, subtitle: body.subtitle?.trim() ?? '', buttonText, link: body.link,
    imageUrl: body.imageUrl || undefined, desktopImageUrl: body.desktopImageUrl || undefined, startsOn: body.startsOn, endsOn: body.endsOn || null,
  };
}

function create(body: BannerDraft): Banner {
  const banner: StoredBanner = { id: `ban-${Date.now().toString(36)}`, ...clean(body), paused: false };
  db().banners.push(banner);
  save();
  return withStatus(banner);
}

function update(b: StoredBanner, body: BannerDraft): Banner {
  Object.assign(b, { imageUrl: undefined, desktopImageUrl: undefined }, clean(body));
  save();
  return withStatus(b);
}

function reorder(placement: BannerPlacement, ids: string[]): Banner[] {
  const all = db().banners;
  if (ids.length !== all.filter(b => b.placement === placement).length || ids.some(id => find(id).placement !== placement)) {
    throw new MockError(400, 'The list changed. Reload and try again.');
  }
  db().banners = reorderSubset(all, ids);
  save();
  return db().banners.map(withStatus);
}

function setPaused(b: StoredBanner, paused: boolean): Banner {
  b.paused = paused;
  save();
  return withStatus(b);
}

function remove(b: StoredBanner): object {
  db().banners = db().banners.filter(x => x !== b);
  save();
  return {};
}
