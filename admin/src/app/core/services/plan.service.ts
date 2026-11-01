import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API } from '../constants/api-endpoints';
import { withoutErrorAlert } from '../interceptors/error.interceptor';
import { Plan, PlanDraft } from '../models/plan.model';

/** Membership plans: price, sessions, discount and benefits. */
@Injectable({ providedIn: 'root' })
export class PlanService {
  private http = inject(HttpClient);

  list(): Observable<Plan[]> {
    return this.http.get<Plan[]>(API.plans);
  }

  /** Create (no id) or update. The editor shows errors itself. */
  save(draft: PlanDraft, id?: string): Observable<Plan> {
    const request = id
      ? this.http.put<Plan>(`${API.plans}/${id}`, draft, { context: withoutErrorAlert() })
      : this.http.post<Plan>(API.plans, draft, { context: withoutErrorAlert() });
    return request;
  }
}
