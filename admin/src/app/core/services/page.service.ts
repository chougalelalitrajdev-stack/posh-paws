import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API } from '../constants/api-endpoints';
import { withoutErrorAlert } from '../interceptors/error.interceptor';
import { Faq, FaqData, FaqDraft, PageKey, PageSection, SitePage } from '../models/page.model';

/** The words on the customer app's pages (draft → publish) and its FAQs. */
@Injectable({ providedIn: 'root' })
export class PageService {
  private http = inject(HttpClient);

  pages(): Promise<SitePage[]> {
    return firstValueFrom(this.http.get<SitePage[]>(API.pages));
  }

  /** The editor shows errors itself. */
  saveDraft(key: PageKey, sections: PageSection[]): Promise<SitePage> {
    return firstValueFrom(this.http.put<SitePage>(`${API.pages}/${key}/draft`, { sections }, { context: withoutErrorAlert() }));
  }

  discardDraft(key: PageKey): Promise<SitePage> {
    return firstValueFrom(this.http.delete<SitePage>(`${API.pages}/${key}/draft`));
  }

  publish(key: PageKey): Promise<SitePage> {
    return firstValueFrom(this.http.post<SitePage>(`${API.pages}/${key}/publish`, {}));
  }

  faqs(): Promise<FaqData> {
    return firstValueFrom(this.http.get<FaqData>(API.faqs));
  }

  /** Create (no id) or update. The dialog shows errors itself. */
  saveFaq(draft: FaqDraft, id?: string): Promise<Faq> {
    const request = id
      ? this.http.put<Faq>(`${API.faqs}/${id}`, draft, { context: withoutErrorAlert() })
      : this.http.post<Faq>(API.faqs, draft, { context: withoutErrorAlert() });
    return firstValueFrom(request);
  }

  removeFaq(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${API.faqs}/${id}`));
  }

  reorderFaqs(groupId: string, ids: string[]): Promise<FaqData> {
    return firstValueFrom(this.http.put<FaqData>(`${API.faqs}/order`, { groupId, ids }));
  }
}
