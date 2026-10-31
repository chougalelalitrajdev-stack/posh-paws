import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API } from '../constants/api-endpoints';
import { withoutErrorAlert } from '../interceptors/error.interceptor';
import { Banner, BannerDraft, BannerPlacement } from '../models/banner.model';

/** Promo banners in the customer app. */
@Injectable({ providedIn: 'root' })
export class BannerService {
  private http = inject(HttpClient);

  /** Every banner, in display order. */
  list(): Promise<Banner[]> {
    return firstValueFrom(this.http.get<Banner[]>(API.banners));
  }

  /** Create (no id) or update. The editor shows errors itself. */
  save(draft: BannerDraft, id?: string): Promise<Banner> {
    const request = id
      ? this.http.put<Banner>(`${API.banners}/${id}`, draft, { context: withoutErrorAlert() })
      : this.http.post<Banner>(API.banners, draft, { context: withoutErrorAlert() });
    return firstValueFrom(request);
  }

  reorder(placement: BannerPlacement, ids: string[]): Promise<Banner[]> {
    return firstValueFrom(this.http.put<Banner[]>(`${API.banners}/order`, { placement, ids }));
  }

  setPaused(id: string, paused: boolean): Promise<Banner> {
    return firstValueFrom(this.http.post<Banner>(`${API.banners}/${id}/${paused ? 'pause' : 'resume'}`, {}));
  }

  remove(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${API.banners}/${id}`));
  }
}
