import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API } from '../constants/api-endpoints';
import { withoutErrorAlert } from '../interceptors/error.interceptor';
import { Offer, OfferDraft } from '../models/offer.model';

/** Discounts and coupon codes. Customers redeem them at checkout once the backend is live. */
@Injectable({ providedIn: 'root' })
export class OfferService {
  private http = inject(HttpClient);

  list(): Promise<Offer[]> {
    return firstValueFrom(this.http.get<Offer[]>(API.offers));
  }

  /** Create (no id) or update. The editor shows errors itself. */
  save(draft: OfferDraft, id?: string): Promise<Offer> {
    const request = id
      ? this.http.put<Offer>(`${API.offers}/${id}`, draft, { context: withoutErrorAlert() })
      : this.http.post<Offer>(API.offers, draft, { context: withoutErrorAlert() });
    return firstValueFrom(request);
  }

  setPaused(id: string, paused: boolean): Promise<Offer> {
    return firstValueFrom(this.http.post<Offer>(`${API.offers}/${id}/${paused ? 'pause' : 'resume'}`, {}));
  }
}
