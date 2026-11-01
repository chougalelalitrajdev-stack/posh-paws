import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';
import { API } from '../constants/api-endpoints';
import { PROCESS_STEPS, SERVICE_HIGHLIGHTS, TESTIMONIALS, TRUST_PILLS } from '../constants/content.constants';
import { PlanItem, ServiceItem } from '../models/catalog.model';
import { PetType } from '../models/pet.model';

/**
 * Grooming services and membership plans (from the API, loaded once),
 * plus the marketing copy several pages share.
 */
@Injectable({ providedIn: 'root' })
export class CatalogService {
  private http = inject(HttpClient);

  /** Loaded once when the app starts; empty until then (or if the request fails, which shows a toast). */
  readonly services = toSignal(this.http.get<ServiceItem[]>(API.services).pipe(catchError(() => of([]))), { initialValue: [] });
  readonly plans = toSignal(this.http.get<PlanItem[]>(API.plans).pipe(catchError(() => of([]))), { initialValue: [] });

  readonly testimonials = TESTIMONIALS;
  readonly processSteps = PROCESS_STEPS;
  readonly serviceHighlights = SERVICE_HIGHLIGHTS;
  readonly trustPills = TRUST_PILLS;

  servicesFor(petType: PetType): ServiceItem[] {
    return this.services().filter(s => s.petType === petType);
  }

  serviceById(id: string | null): ServiceItem | undefined {
    return this.services().find(s => s.id === id);
  }
}
