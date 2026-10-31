import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API } from '../constants/api-endpoints';
import { DashboardSummary } from '../models/dashboard.model';

/** Everything the Today screen shows, in one call. */
@Injectable({ providedIn: 'root' })
export class DashboardService {
  private http = inject(HttpClient);

  summary(): Promise<DashboardSummary> {
    return firstValueFrom(this.http.get<DashboardSummary>(API.dashboard));
  }
}
