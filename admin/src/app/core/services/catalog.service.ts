import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, finalize, forkJoin, map, of, shareReplay, switchMap, tap } from 'rxjs';
import { API } from '../constants/api-endpoints';
import { withoutErrorAlert } from '../interceptors/error.interceptor';
import { PetType, Service, ServiceDraft, Station, StationDraft } from '../models/catalog.model';

/** Services and stations, loaded once and shared by every screen; Catalog › Services and Availability › Stations edit them. */
@Injectable({ providedIn: 'root' })
export class CatalogService {
  private http = inject(HttpClient);

  private readonly _services = signal<Service[]>([]);
  private readonly _stations = signal<Station[]>([]);
  private loaded = false;
  private loading$: Observable<void> | null = null;

  /** Every service, archived ones included, in display order. */
  readonly services = this._services.asReadonly();
  readonly stations = this._stations.asReadonly();

  /** Loads once: later calls complete straight away, and calls while loading share one request. */
  load(): Observable<void> {
    if (this.loaded) return of(undefined);
    this.loading$ ??= this.fetch().pipe(
      finalize(() => (this.loading$ = null)),
      shareReplay(1),
    );
    return this.loading$;
  }

  /** Bookable services for a pet type (not archived), in display order. */
  servicesFor(petType: PetType): Service[] {
    return this._services().filter(s => s.petType === petType && !s.archived);
  }

  stationName(id: string | null): string {
    return this._stations().find(s => s.id === id)?.name ?? '';
  }

  /** Whether a station can do a service. For display; the server applies the same rule when it offers slots. */
  stationCanDo(st: Station, service: Service): boolean {
    if (st.canDo === 'all') return true;
    if (st.canDo === 'some') return st.serviceIds.includes(service.id);
    return service.petType === (st.canDo === 'dogs' ? 'dog' : 'cat');
  }

  /** Stations in use that can do a service. */
  stationsFor(service: Service): Station[] {
    return this._stations().filter(st => st.active && this.stationCanDo(st, service));
  }

  /** Create (no id) or update a station, then refresh the shared lists. The dialog shows errors itself. */
  saveStation(draft: StationDraft, id?: string): Observable<Station> {
    const request = id
      ? this.http.put<Station>(`${API.stations}/${id}`, draft, { context: withoutErrorAlert() })
      : this.http.post<Station>(API.stations, draft, { context: withoutErrorAlert() });
    return request.pipe(switchMap(saved => this.fetch().pipe(map(() => saved))));
  }

  removeStation(id: string): Observable<void> {
    return this.http.delete<void>(`${API.stations}/${id}`, { context: withoutErrorAlert() }).pipe(switchMap(() => this.fetch()));
  }

  /** Create (no id) or update a service, then refresh the shared list. The editor shows errors itself. */
  saveService(draft: ServiceDraft, id?: string): Observable<Service> {
    const request = id
      ? this.http.put<Service>(`${API.services}/${id}`, draft, { context: withoutErrorAlert() })
      : this.http.post<Service>(API.services, draft, { context: withoutErrorAlert() });
    return request.pipe(switchMap(saved => this.fetch().pipe(map(() => saved))));
  }

  reorder(petType: PetType, ids: string[]): Observable<Service[]> {
    return this.http.put<Service[]>(`${API.services}/order`, { petType, ids }).pipe(tap(list => this._services.set(list)));
  }

  setArchived(id: string, archived: boolean): Observable<Service> {
    return this.http.post<Service>(`${API.services}/${id}/${archived ? 'archive' : 'restore'}`, {}).pipe(
      switchMap(saved => this.fetch().pipe(map(() => saved))),
    );
  }

  private fetch(): Observable<void> {
    return forkJoin({ services: this.http.get<Service[]>(API.services), stations: this.http.get<Station[]>(API.stations) }).pipe(
      tap(({ services, stations }) => {
        this._services.set(services);
        this._stations.set(stations);
        this.loaded = true;
      }),
      map(() => undefined),
    );
  }
}
