import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API } from '../constants/api-endpoints';
import { Paged } from '../models/paged.model';
import { Payment, PaymentFilters, PaymentSummary } from '../models/payment.model';

/** Payment links from bookings and plans, and refunds (Super Admin). */
@Injectable({ providedIn: 'root' })
export class PaymentService {
  private http = inject(HttpClient);

  list(f: PaymentFilters): Promise<Paged<Payment>> {
    const params = { tab: f.tab, from: f.from, to: f.to, page: f.page, pageSize: f.pageSize };
    return firstValueFrom(this.http.get<Paged<Payment>>(API.payments, { params }));
  }

  summary(from: string, to: string): Promise<PaymentSummary> {
    return firstValueFrom(this.http.get<PaymentSummary>(API.paymentSummary, { params: { from, to } }));
  }

  refund(id: string): Promise<Payment> {
    return firstValueFrom(this.http.post<Payment>(`${API.payments}/${id}/refund`, {}));
  }
}
