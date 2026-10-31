import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API } from '../constants/api-endpoints';
import { withoutErrorAlert } from '../interceptors/error.interceptor';
import { ActivityEntry } from '../models/booking.model';
import { Customer, CustomerDetails, CustomerFilters, CustomerSegment, CustomerSummary, PaymentRecord } from '../models/customer.model';
import { Paged } from '../models/paged.model';

/** Customers: the list with segments, the profile, and its tabs. Pets have their own PetService. */
@Injectable({ providedIn: 'root' })
export class CustomerService {
  private http = inject(HttpClient);

  list(filters: CustomerFilters): Promise<Paged<CustomerSummary>> {
    const params: Record<string, string | number> = {};
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== '' && value !== 'all') params[key] = value as string | number;
    }
    return firstValueFrom(this.http.get<Paged<CustomerSummary>>(API.customers, { params }));
  }

  counts(): Promise<Record<CustomerSegment, number>> {
    return firstValueFrom(this.http.get<Record<CustomerSegment, number>>(API.customerCounts));
  }

  get(id: string): Promise<Customer> {
    return firstValueFrom(this.http.get<Customer>(`${API.customers}/${id}`));
  }

  /** The customer with this mobile number, or null. */
  findByPhone(phone: string): Promise<Customer | null> {
    return firstValueFrom(this.http.get<Customer | null>(API.customerLookup, { params: { phone: phone.replace(/\D/g, '') } }));
  }

  /** Forms show these errors inline. */
  create(details: CustomerDetails): Promise<Customer> {
    return firstValueFrom(this.http.post<Customer>(API.customers, details, { context: withoutErrorAlert() }));
  }

  update(id: string, details: CustomerDetails): Promise<Customer> {
    return firstValueFrom(this.http.put<Customer>(`${API.customers}/${id}`, details, { context: withoutErrorAlert() }));
  }

  saveNote(id: string, text: string): Promise<Customer> {
    return firstValueFrom(this.http.put<Customer>(`${API.customers}/${id}/note`, { text }));
  }

  payments(id: string): Promise<PaymentRecord[]> {
    return firstValueFrom(this.http.get<PaymentRecord[]>(`${API.customers}/${id}/payments`));
  }

  activity(id: string): Promise<ActivityEntry[]> {
    return firstValueFrom(this.http.get<ActivityEntry[]>(`${API.customers}/${id}/activity`));
  }
}
