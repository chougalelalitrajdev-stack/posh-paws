import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API } from '../constants/api-endpoints';
import { Paged } from '../models/paged.model';
import { Subscription, SubscriptionSummary, SubscriptionTab } from '../models/subscription.model';

/** Customers on a plan. Plan prices and benefits are managed in Catalog (Phase D). */
@Injectable({ providedIn: 'root' })
export class SubscriptionService {
  private http = inject(HttpClient);

  list(tab: SubscriptionTab, page = 1, pageSize = 10): Promise<Paged<Subscription>> {
    return firstValueFrom(this.http.get<Paged<Subscription>>(API.subscriptions, { params: { tab, page, pageSize } }));
  }

  summary(): Promise<SubscriptionSummary> {
    return firstValueFrom(this.http.get<SubscriptionSummary>(API.subscriptionSummary));
  }

  /** Renewal link for an active plan, or the first-payment link for a pending one. */
  sendPaymentLink(id: string): Promise<Subscription> {
    return firstValueFrom(this.http.post<Subscription>(`${API.subscriptions}/${id}/payment-link`, {}));
  }
}
