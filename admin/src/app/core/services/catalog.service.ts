import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API } from '../constants/api-endpoints';
import { PetType, Service, Station } from '../models/catalog.model';

/** Services and stations, loaded once and shared by every screen. Phase D adds editing. */
@Injectable({ providedIn: 'root' })
export class CatalogService {
  private http = inject(HttpClient);

  private readonly _services = signal<Service[]>([]);
  private readonly _stations = signal<Station[]>([]);
  private loading: Promise<void> | null = null;

  readonly services = this._services.asReadonly();
  readonly stations = this._stations.asReadonly();

  /** Loads once; later calls reuse the same result. */
  load(): Promise<void> {
    this.loading ??= Promise.all([
      firstValueFrom(this.http.get<Service[]>(API.services)),
      firstValueFrom(this.http.get<Station[]>(API.stations)),
    ]).then(([services, stations]) => {
      this._services.set(services);
      this._stations.set(stations);
    }).catch(e => {
      this.loading = null;
      throw e;
    });
    return this.loading;
  }

  servicesFor(petType: PetType): Service[] {
    return this._services().filter(s => s.petType === petType && s.active);
  }

  stationName(id: string | null): string {
    return this._stations().find(s => s.id === id)?.name ?? '';
  }
}
