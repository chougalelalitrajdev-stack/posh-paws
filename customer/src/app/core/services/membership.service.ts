import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { Observable, catchError, of, switchMap, tap } from 'rxjs';
import { API } from '../constants/api-endpoints';
import { withoutErrorAlert } from '../interceptors/error.interceptor';
import { Membership } from '../models/membership.model';
import { AuthService } from './auth.service';

/** The logged-in customer's plan. Reloads on login, clears on logout, and after a booking or cancel uses or gives back a session. */
@Injectable({ providedIn: 'root' })
export class MembershipService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);

  private readonly _current = signal<Membership | null>(null);
  readonly current = this._current.asReadonly();

  /** Bump to load again. */
  private version = signal(0);
  private query = computed(() => ({ userId: this.auth.user()?.id ?? null, version: this.version() }));

  constructor() {
    // A new user cancels the previous user's request (switchMap), so plans never mix.
    toObservable(this.query).pipe(
      switchMap(({ userId }) => (userId ? this.http.get<Membership | null>(API.currentSubscription).pipe(catchError(() => of(null))) : of(null))),
      takeUntilDestroyed(),
    ).subscribe(m => this._current.set(m));
  }

  reload(): void {
    this.version.update(v => v + 1);
  }

  /** Called once the first month is paid. Shows a 409 inline when they're already on a plan. */
  subscribe(planId: string): Observable<Membership> {
    return this.http.post<Membership>(API.subscriptions, { planId }, { context: withoutErrorAlert() }).pipe(
      tap(m => this._current.set(m)),
    );
  }
}
