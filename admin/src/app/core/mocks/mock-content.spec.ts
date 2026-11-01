import { HttpClient, HttpErrorResponse, HttpHeaders, provideHttpClient, withInterceptors } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { API } from '../constants/api-endpoints';
import { Banner } from '../models/banner.model';
import { DashboardSummary } from '../models/dashboard.model';
import { GalleryData } from '../models/gallery.model';
import { FaqData, SitePage } from '../models/page.model';
import { AlertService } from '../services/alert.service';
import { STORAGE_LIMIT, db, resetDb } from './mock-db';
import { mockInterceptor } from './mock.interceptor';

const admin = new HttpHeaders({ Authorization: 'Bearer mock-staff:st-2' }); // Meera K., Admin
const staff = new HttpHeaders({ Authorization: 'Bearer mock-staff:st-3' }); // Amit J., Staff

describe('mock banners, gallery, pages and FAQs', () => {
  let http: HttpClient;
  const get = <T>(url: string) => firstValueFrom(http.get<T>(url, { headers: admin }));
  const send = <T>(method: 'POST' | 'PUT' | 'DELETE', url: string, body: object = {}, headers = admin) =>
    firstValueFrom(http.request<T>(method, url, { headers, body }));
  const statusOf = (p: Promise<unknown>) => p.then(() => 200, (e: HttpErrorResponse) => e.status);

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 27, 8, 0));
    resetDb();
    TestBed.configureTestingModule({ providers: [provideHttpClient(withInterceptors([mockInterceptor]))] });
    http = TestBed.inject(HttpClient);
  });

  afterEach(() => vi.useRealTimers());

  it('lets staff read content but not change it', async () => {
    expect((await get<Banner[]>(API.banners)).length).toBeGreaterThan(0);
    expect(await statusOf(send('POST', `${API.banners}/ban-1/pause`, {}, staff))).toBe(403);
    expect(await statusOf(send('POST', `${API.gallery}/bulk`, { action: 'hide', ids: ['ph-1'] }, staff))).toBe(403);
    expect(await statusOf(send('POST', `${API.pages}/about/publish`, {}, staff))).toBe(403);
  });

  it('works out banner status and reorders within a placement', async () => {
    const banners = await get<Banner[]>(API.banners);
    const status = Object.fromEntries(banners.map(b => [b.id, b.status]));
    expect(status).toMatchObject({ 'ban-1': 'live', 'ban-2': 'scheduled', 'ban-3': 'ended', 'ban-6': 'paused' });

    const after = await send<Banner[]>('PUT', `${API.banners}/order`, { placement: 'home_hero', ids: ['ban-2', 'ban-1', 'ban-3'] });
    expect(after.filter(b => b.placement === 'home_hero').map(b => b.id)).toEqual(['ban-2', 'ban-1', 'ban-3']);
    expect(after.map(b => b.id).slice(3)).toEqual(['ban-4', 'ban-5', 'ban-6']); // other placements untouched
    expect(await statusOf(send('PUT', `${API.banners}/order`, { placement: 'home_hero', ids: ['ban-2', 'ban-1'] }))).toBe(400);

    const long = { ...banners[0], title: 'x'.repeat(49) };
    expect(await statusOf(send('PUT', `${API.banners}/ban-1`, long))).toBe(400);
  });

  it('shows the banners ending soon on the dashboard', async () => {
    const d = await get<DashboardSummary>(API.dashboard);
    expect(d.content[0]).toMatchObject({ title: 'Diwali grooming week', status: 'Ends in 2 days', tone: 'warn' });
    expect(d.attention.some(a => a.kind === 'content' && a.title === 'Diwali grooming week banner ends in 2 days')).toBe(true);
    expect(d.content.some(c => c.title === 'About' && c.status === 'Draft')).toBe(true);
  });

  it('adds photos hidden, needs a caption to show them, and keeps categories with photos', async () => {
    const added = await send<{ id: string; visible: boolean }>('POST', API.gallery, { imageUrl: 'data:image/jpeg;base64,AAA', categoryId: 'gc-studio', caption: '' });
    expect(added.visible).toBe(false);
    expect(await statusOf(send('POST', `${API.gallery}/bulk`, { action: 'show', ids: [added.id] }))).toBe(400);

    const moved = await send<GalleryData>('POST', `${API.gallery}/bulk`, { action: 'move', ids: ['ph-1', 'ph-4'], categoryId: 'gc-events' });
    expect(moved.categories.find(c => c.id === 'gc-events')?.photoCount).toBe(3);

    const happy = moved.photos.filter(p => p.categoryId === 'gc-happy').map(p => p.id);
    const reordered = await send<GalleryData>('PUT', `${API.gallery}/order`, { ids: [...happy].reverse() });
    expect(reordered.photos.filter(p => p.categoryId === 'gc-happy').map(p => p.id)).toEqual([...happy].reverse());

    const keepAllBut = (id: string) => moved.categories.filter(c => c.id !== id).map(({ id, name }) => ({ id, name }));
    expect(await statusOf(send('PUT', `${API.gallery}/categories`, { categories: keepAllBut('gc-events') }))).toBe(409);
    const renamed = await send<GalleryData>('PUT', `${API.gallery}/categories`, { categories: [...moved.categories.map(({ id, name }) => ({ id, name })), { name: 'Cats' }] });
    expect(renamed.categories.map(c => c.name)).toContain('Cats');
  });

  it('saves a page draft, keeps fixed sections, and publishes it', async () => {
    const about = (await get<SitePage[]>(API.pages)).find(p => p.key === 'about')!;
    expect(about.draft).not.toBeNull();
    const withoutValues = about.draft!.filter(s => s.id !== 'about-values');
    expect(await statusOf(send('PUT', `${API.pages}/about/draft`, { sections: withoutValues }))).toBe(400);

    const added = [...about.draft!, { id: '', kind: '', heading: 'Parking', body: 'Free parking at the back.', visible: true, fixed: false }];
    const saved = await send<SitePage>('PUT', `${API.pages}/about/draft`, { sections: added });
    expect(saved.draft!.at(-1)).toMatchObject({ kind: 'Text', fixed: false, heading: 'Parking' });
    expect(saved.draftSavedBy).toBe('Meera K.');

    const published = await send<SitePage>('POST', `${API.pages}/about/publish`);
    expect(published).toMatchObject({ draft: null, publishedBy: 'Meera K.' });
    expect(published.sections.find(s => s.id === 'about-team')?.visible).toBe(true);
    expect(await statusOf(send('POST', `${API.pages}/about/publish`))).toBe(409);
  });

  it('warns when demo photo storage is nearly full and refuses uploads once it is', async () => {
    const upload = () => {
      const body = new FormData();
      body.append('file', new Blob(['x'.repeat(1000)], { type: 'image/jpeg' }), 'photo.jpg');
      return firstValueFrom(http.post<{ url: string }>(API.uploads, body, { headers: admin }));
    };
    const filler = (chars: number) => db().gallery.push({ ...db().gallery[0], id: 'big', imageUrl: 'x'.repeat(chars) });

    filler(STORAGE_LIMIT * 0.8);
    expect((await upload()).url).toMatch(/^data:image\/jpeg/);
    expect(TestBed.inject(AlertService).alerts().at(-1)?.message).toMatch(/^Demo photo storage is \d+% full/);

    db().gallery.pop();
    filler(STORAGE_LIMIT);
    expect(await statusOf(upload())).toBe(507);
  });

  it('adds FAQs at the end of their group and reorders a group', async () => {
    const created = await send<{ id: string }>('POST', API.faqs, { groupId: 'fg-booking', question: 'Do you groom puppies?', answer: 'Yes, from 12 weeks.' });
    let data = await get<FaqData>(API.faqs);
    const booking = data.faqs.filter(f => f.groupId === 'fg-booking').map(f => f.id);
    expect(booking.at(-1)).toBe(created.id);
    expect(data.faqs.findIndex(f => f.id === created.id)).toBe(3); // before the Membership group

    data = await send<FaqData>('PUT', `${API.faqs}/order`, { groupId: 'fg-booking', ids: [...booking].reverse() });
    expect(data.faqs.slice(0, 4).map(f => f.id)).toEqual([...booking].reverse());
    expect(await statusOf(send('POST', API.faqs, { groupId: 'fg-booking', question: '', answer: 'x' }))).toBe(400);
  });
});
