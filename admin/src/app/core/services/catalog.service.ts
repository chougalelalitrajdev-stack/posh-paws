import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API } from '../constants/api-endpoints';
import { withoutErrorAlert } from '../interceptors/error.interceptor';
import { PetType, Service, ServiceDraft, Station } from '../models/catalog.model';

/** Services and stations, loaded once and shared by every screen; Catalog › Services edits them. */
@Injectable({ providedIn: 'root' })
export class CatalogService {
  private http = inject(HttpClient);

  private readonly _services = signal<Service[]>([]);
  private readonly _stations = signal<Station[]>([]);
  private loading: Promise<void> | null = null;

  /** Every service, archived ones included, in display order. */
  readonly services = this._services.asReadonly();
  readonly stations = this._stations.asReadonly();

  /** Loads once; later calls reuse the same result. */
  load(): Promise<void> {
    this.loading ??= this.fetch().catch(e => {
      this.loading = null;
      throw e;
    });
    return this.loading;
  }

  /** Bookable services for a pet type (not archived), in display order. */
  servicesFor(petType: PetType): Service[] {
    return this._services().filter(s => s.petType === petType && !s.archived);
  }

  stationName(id: string | null): string {
    return this._stations().find(s => s.id === id)?.name ?? '';
  }

  /** Create (no id) or update a service. The editor shows errors itself. */
  async saveService(draft: ServiceDraft, id?: string): Promise<Service> {
    const request = id
      ? this.http.put<Service>(`${API.services}/${id}`, draft, { context: withoutErrorAlert() })
      : this.http.post<Service>(API.services, draft, { context: withoutErrorAlert() });
    const saved = await firstValueFrom(request);
    await this.fetch();
    return saved;
  }

  async reorder(petType: PetType, ids: string[]): Promise<void> {
    this._services.set(await firstValueFrom(this.http.put<Service[]>(`${API.services}/order`, { petType, ids })));
  }

  async setArchived(id: string, archived: boolean): Promise<Service> {
    const s = await firstValueFrom(this.http.post<Service>(`${API.services}/${id}/${archived ? 'archive' : 'restore'}`, {}));
    await this.fetch();
    return s;
  }

  private async fetch(): Promise<void> {
    const [services, stations] = await Promise.all([
      firstValueFrom(this.http.get<Service[]>(API.services)),
      firstValueFrom(this.http.get<Station[]>(API.stations)),
    ]);
    this._services.set(services);
    this._stations.set(stations);
  }
}
