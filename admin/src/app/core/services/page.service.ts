import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API } from '../constants/api-endpoints';
import { withoutErrorAlert } from '../interceptors/error.interceptor';
import { Faq, FaqData, FaqDraft, PageKey, PageSection, SitePage } from '../models/page.model';

/** The words on the customer app's pages (draft → publish) and its FAQs. */
@Injectable({ providedIn: 'root' })
export class PageService {
  private http = inject(HttpClient);

  pages(): Observable<SitePage[]> {
    return this.http.get<SitePage[]>(API.pages);
  }

  /** The editor shows errors itself. */
  saveDraft(key: PageKey, sections: PageSection[]): Observable<SitePage> {
    return this.http.put<SitePage>(`${API.pages}/${key}/draft`, { sections }, { context: withoutErrorAlert() });
  }

  discardDraft(key: PageKey): Observable<SitePage> {
    return this.http.delete<SitePage>(`${API.pages}/${key}/draft`);
  }

  publish(key: PageKey): Observable<SitePage> {
    return this.http.post<SitePage>(`${API.pages}/${key}/publish`, {});
  }

  faqs(): Observable<FaqData> {
    return this.http.get<FaqData>(API.faqs);
  }

  /** Create (no id) or update. The dialog shows errors itself. */
  saveFaq(draft: FaqDraft, id?: string): Observable<Faq> {
    const request = id
      ? this.http.put<Faq>(`${API.faqs}/${id}`, draft, { context: withoutErrorAlert() })
      : this.http.post<Faq>(API.faqs, draft, { context: withoutErrorAlert() });
    return request;
  }

  removeFaq(id: string): Observable<void> {
    return this.http.delete<void>(`${API.faqs}/${id}`);
  }

  reorderFaqs(groupId: string, ids: string[]): Observable<FaqData> {
    return this.http.put<FaqData>(`${API.faqs}/order`, { groupId, ids });
  }
}
