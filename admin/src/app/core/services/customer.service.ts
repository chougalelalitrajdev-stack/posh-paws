import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API } from '../constants/api-endpoints';
import { withoutErrorAlert } from '../interceptors/error.interceptor';
import { ActivityEntry } from '../models/booking.model';
import { Customer, CustomerDetails, CustomerFilters, CustomerSegment, CustomerSummary } from '../models/customer.model';
import { Payment } from '../models/payment.model';
import { Paged } from '../models/paged.model';

/** Customers: the list with segments, the profile, and its tabs. Pets have their own PetService. */
@Injectable({ providedIn: 'root' })
export class CustomerService {
  private http = inject(HttpClient);

  list(filters: CustomerFilters): Observable<Paged<CustomerSummary>> {
    const params: Record<string, string | number> = {};
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== '' && value !== 'all') params[key] = value as string | number;
    }
    return this.http.get<Paged<CustomerSummary>>(API.customers, { params });
  }

  counts(): Observable<Record<CustomerSegment, number>> {
    return this.http.get<Record<CustomerSegment, number>>(API.customerCounts);
  }

  get(id: string): Observable<Customer> {
    return this.http.get<Customer>(`${API.customers}/${id}`);
  }

  /** The customer with this mobile number, or null. */
  findByPhone(phone: string): Observable<Customer | null> {
    return this.http.get<Customer | null>(API.customerLookup, { params: { phone: phone.replace(/\D/g, '') } });
  }

  /** Forms show these errors inline. */
  create(details: CustomerDetails): Observable<Customer> {
    return this.http.post<Customer>(API.customers, details, { context: withoutErrorAlert() });
  }

  update(id: string, details: CustomerDetails): Observable<Customer> {
    return this.http.put<Customer>(`${API.customers}/${id}`, details, { context: withoutErrorAlert() });
  }

  saveNote(id: string, text: string): Observable<Customer> {
    return this.http.put<Customer>(`${API.customers}/${id}/note`, { text });
  }

  payments(id: string): Observable<Payment[]> {
    return this.http.get<Payment[]>(`${API.customers}/${id}/payments`);
  }

  activity(id: string): Observable<ActivityEntry[]> {
    return this.http.get<ActivityEntry[]>(`${API.customers}/${id}/activity`);
  }
}
