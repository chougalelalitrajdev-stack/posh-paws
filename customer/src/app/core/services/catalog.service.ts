import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
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

  private readonly _services = signal<ServiceItem[]>([]);
  private readonly _plans = signal<PlanItem[]>([]);

  readonly services = this._services.asReadonly();
  readonly plans = this._plans.asReadonly();

  readonly testimonials = TESTIMONIALS;
  readonly processSteps = PROCESS_STEPS;
  readonly serviceHighlights = SERVICE_HIGHLIGHTS;
  readonly trustPills = TRUST_PILLS;

  constructor() {
    void this.load();
  }

  servicesFor(petType: PetType): ServiceItem[] {
    return this._services().filter(s => s.petType === petType);
  }

  serviceById(id: string | null): ServiceItem | undefined {
    return this._services().find(s => s.id === id);
  }

  private async load(): Promise<void> {
    const [services, plans] = await Promise.all([
      firstValueFrom(this.http.get<ServiceItem[]>(API.services)),
      firstValueFrom(this.http.get<PlanItem[]>(API.plans)),
    ]);
    this._services.set(services);
    this._plans.set(plans);
  }
}
