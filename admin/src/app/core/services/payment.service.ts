import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API } from '../constants/api-endpoints';
import { Paged } from '../models/paged.model';
import { Payment, PaymentFilters, PaymentSummary } from '../models/payment.model';

/** Payment links from bookings and plans, and refunds (Super Admin). */
@Injectable({ providedIn: 'root' })
export class PaymentService {
  private http = inject(HttpClient);

  list(f: PaymentFilters): Observable<Paged<Payment>> {
    const params = { tab: f.tab, from: f.from, to: f.to, page: f.page, pageSize: f.pageSize };
    return this.http.get<Paged<Payment>>(API.payments, { params });
  }

  summary(from: string, to: string): Observable<PaymentSummary> {
    return this.http.get<PaymentSummary>(API.paymentSummary, { params: { from, to } });
  }

  refund(id: string): Observable<Payment> {
    return this.http.post<Payment>(`${API.payments}/${id}/refund`, {});
  }
}
