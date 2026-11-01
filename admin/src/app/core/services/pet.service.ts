import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API } from '../constants/api-endpoints';
import { withoutErrorAlert } from '../interceptors/error.interceptor';
import { CustomerPet, PetDraft } from '../models/customer.model';
import { Paged } from '../models/paged.model';
import { PetCounts, PetFilters, PetRecord, PetSummary } from '../models/pet.model';

/** Every pet on file. The same record is used for grooming now and vet care later. */
@Injectable({ providedIn: 'root' })
export class PetService {
  private http = inject(HttpClient);

  list(filters: PetFilters): Observable<Paged<PetSummary>> {
    const params: Record<string, string | number | boolean> = {};
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== '' && value !== false) params[key] = value as string | number | boolean;
    }
    return this.http.get<Paged<PetSummary>>(API.pets, { params });
  }

  counts(): Observable<PetCounts> {
    return this.http.get<PetCounts>(API.petCounts);
  }

  get(id: string): Observable<PetRecord> {
    return this.http.get<PetRecord>(`${API.pets}/${id}`);
  }

  /** Forms show these errors inline. */
  add(customerId: string, pet: PetDraft): Observable<CustomerPet> {
    return this.http.post<CustomerPet>(`${API.customers}/${customerId}/pets`, pet, { context: withoutErrorAlert() });
  }

  update(id: string, pet: PetDraft): Observable<CustomerPet> {
    return this.http.put<CustomerPet>(`${API.pets}/${id}`, pet, { context: withoutErrorAlert() });
  }
}
