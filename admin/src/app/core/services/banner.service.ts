import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API } from '../constants/api-endpoints';
import { withoutErrorAlert } from '../interceptors/error.interceptor';
import { Banner, BannerDraft, BannerPlacement } from '../models/banner.model';

/** Promo banners in the customer app. */
@Injectable({ providedIn: 'root' })
export class BannerService {
  private http = inject(HttpClient);

  /** Every banner, in display order. */
  list(): Observable<Banner[]> {
    return this.http.get<Banner[]>(API.banners);
  }

  /** Create (no id) or update. The editor shows errors itself. */
  save(draft: BannerDraft, id?: string): Observable<Banner> {
    const request = id
      ? this.http.put<Banner>(`${API.banners}/${id}`, draft, { context: withoutErrorAlert() })
      : this.http.post<Banner>(API.banners, draft, { context: withoutErrorAlert() });
    return request;
  }

  reorder(placement: BannerPlacement, ids: string[]): Observable<Banner[]> {
    return this.http.put<Banner[]>(`${API.banners}/order`, { placement, ids });
  }

  setPaused(id: string, paused: boolean): Observable<Banner> {
    return this.http.post<Banner>(`${API.banners}/${id}/${paused ? 'pause' : 'resume'}`, {});
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${API.banners}/${id}`);
  }
}
