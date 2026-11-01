import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { Observable, catchError, distinctUntilChanged, finalize, map, of, switchMap, tap } from 'rxjs';
import { API } from '../constants/api-endpoints';
import { withoutErrorAlert } from '../interceptors/error.interceptor';
import { Pet, PetDraft } from '../models/pet.model';
import { AuthService } from './auth.service';

/** The logged-in user's pets. Reloads on login and clears on logout. */
@Injectable({ providedIn: 'root' })
export class PetService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);

  private readonly _pets = signal<Pet[]>([]);
  private readonly _loading = signal(false);
  private readonly _loaded = signal(false);

  readonly pets = this._pets.asReadonly();
  readonly loading = this._loading.asReadonly();
  /** True once the current user's pets have been fetched. */
  readonly loaded = this._loaded.asReadonly();

  constructor() {
    // A new user cancels the previous user's request (switchMap), so pets never mix.
    toObservable(this.auth.user).pipe(
      map(user => user?.id ?? null),
      distinctUntilChanged(),
      tap(() => this._loaded.set(false)),
      switchMap(userId => (userId ? this.fetch() : of([]))),
      takeUntilDestroyed(),
    ).subscribe(pets => this._pets.set(pets));
  }

  /** The pet dialog shows save errors itself, so no global toast. */
  add(draft: PetDraft): Observable<Pet> {
    return this.http.post<Pet>(API.pets, draft, { context: withoutErrorAlert() }).pipe(
      tap(pet => this._pets.update(list => [...list, pet])),
    );
  }

  update(pet: Pet): Observable<Pet> {
    return this.http.put<Pet>(`${API.pets}/${pet.id}`, pet, { context: withoutErrorAlert() }).pipe(
      tap(saved => this._pets.update(list => list.map(p => (p.id === saved.id ? saved : p)))),
    );
  }

  private fetch(): Observable<Pet[]> {
    this._loading.set(true);
    return this.http.get<Pet[]>(API.pets).pipe(
      tap(() => this._loaded.set(true)),
      catchError(() => of([])), // the error interceptor has shown a toast
      finalize(() => this._loading.set(false)),
    );
  }
}
