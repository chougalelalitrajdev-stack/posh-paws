import { HttpClient } from '@angular/common/http';
import { Injectable, Injector, Signal, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';
import { API } from '../constants/api-endpoints';
import { Banner, BannerPlacement, FaqData, GalleryData, PageKey, PageSection, SitePage } from '../models/content.model';

/**
 * The content staff manage in the admin: banners, gallery, the pages' words and FAQs.
 * Each list loads once and is shared; pages load the first time they're asked for.
 */
@Injectable({ providedIn: 'root' })
export class ContentService {
  private http = inject(HttpClient);
  private injector = inject(Injector);
  private pages = new Map<PageKey, Signal<SitePage | null>>();

  readonly banners = toSignal(this.http.get<Banner[]>(API.banners).pipe(catchError(() => of([]))), { initialValue: [] });
  readonly gallery = toSignal(this.http.get<GalleryData>(API.gallery).pipe(catchError(() => of({ categories: [], photos: [] }))),
    { initialValue: { categories: [], photos: [] } as GalleryData });
  readonly faqs = toSignal(this.http.get<FaqData>(API.faqs).pipe(catchError(() => of({ groups: [], faqs: [] }))),
    { initialValue: { groups: [], faqs: [] } as FaqData });

  /** The banner a placement shows now, if any. */
  banner(placement: BannerPlacement): Signal<Banner | undefined> {
    return computed(() => this.banners().find(b => b.placement === placement));
  }

  /** A page's published words; null while loading (or if it couldn't load). */
  page(key: PageKey): Signal<SitePage | null> {
    let page = this.pages.get(key);
    if (!page) {
      page = toSignal(this.http.get<SitePage>(`${API.pages}/${key}`).pipe(catchError(() => of(null))), { initialValue: null, injector: this.injector });
      this.pages.set(key, page);
    }
    return page;
  }

  /** One section of a page. Undefined while loading, or when staff have hidden it (then the app leaves it out). */
  section(page: SitePage | null, id: string): PageSection | undefined {
    return page?.sections.find(s => s.id === id);
  }

  /** The questions for an app page, from the groups whose "shown on" names it (e.g. "Membership"). */
  faqsFor(pageName: string): Signal<{ question: string; answer: string }[]> {
    return computed(() => {
      const { groups, faqs } = this.faqs();
      const shown = new Set(groups.filter(g => g.shownOn.split(',').some(p => p.trim().toLowerCase() === pageName.toLowerCase())).map(g => g.id));
      return faqs.filter(f => shown.has(f.groupId)).map(({ question, answer }) => ({ question, answer }));
    });
  }
}
