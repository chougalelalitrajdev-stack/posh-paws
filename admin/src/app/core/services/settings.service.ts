import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, finalize, of, shareReplay, switchMap, tap } from 'rxjs';
import { API } from '../constants/api-endpoints';
import { withoutErrorAlert } from '../interceptors/error.interceptor';
import { Closure, Settings, SettingsSection } from '../models/settings.model';
import { StaffRole, TeamMember } from '../models/staff-user.model';

/** Business settings, loaded once and shared (booking screens read the hold amount and slot rules); Settings edits them. Also the team. */
@Injectable({ providedIn: 'root' })
export class SettingsService {
  private http = inject(HttpClient);

  private readonly _settings = signal<Settings | null>(null);
  private loading$: Observable<Settings> | null = null;

  readonly settings = this._settings.asReadonly();
  readonly holdPaise = computed(() => this._settings()?.payments.slotHoldPaise ?? 0);
  readonly linkHours = computed(() => this._settings()?.payments.linkExpiryHours ?? 0);
  /** Shown under the slot picker. */
  readonly rulesNote = computed(() => {
    const b = this._settings()?.booking;
    return b ? `Start times every ${b.slotStepMinutes} min, each with a station free for the whole service plus a ${b.bufferMinutes} min buffer. Breaks and closures are blocked.` : '';
  });

  /** Loads once: later calls emit the current settings straight away, and calls while loading share one request. */
  load(): Observable<Settings> {
    const current = this._settings();
    if (current) return of(current);
    this.loading$ ??= this.http.get<Settings>(API.settings).pipe(
      tap(s => this._settings.set(s)),
      finalize(() => (this.loading$ = null)),
      shareReplay(1),
    );
    return this.loading$;
  }

  /** Saves one section. The page shows errors itself. */
  save<K extends SettingsSection>(section: K, value: Settings[K]): Observable<Settings> {
    return this.http.put<Settings>(`${API.settings}/${section}`, value, { context: withoutErrorAlert() }).pipe(tap(s => this._settings.set(s)));
  }

  /** The dialog shows errors itself. Emits the settings with the new closure (and its booking count). */
  addClosure(closure: Pick<Closure, 'date' | 'name' | 'closesAt'>): Observable<Settings> {
    return this.http.post<Closure>(`${API.settings}/closures`, closure, { context: withoutErrorAlert() }).pipe(
      switchMap(() => this.http.get<Settings>(API.settings)),
      tap(s => this._settings.set(s)),
    );
  }

  removeClosure(id: string): Observable<Settings> {
    return this.http.delete<Settings>(`${API.settings}/closures/${id}`).pipe(tap(s => this._settings.set(s)));
  }

  // ── Team & roles (Super Admin) ──

  team(): Observable<TeamMember[]> {
    return this.http.get<TeamMember[]>(API.team);
  }

  /** The dialog shows errors itself. */
  invite(member: { name: string; email: string; role: StaffRole }): Observable<TeamMember> {
    return this.http.post<TeamMember>(API.team, member, { context: withoutErrorAlert() });
  }

  setRole(id: string, role: StaffRole): Observable<TeamMember> {
    return this.http.put<TeamMember>(`${API.team}/${id}`, { role });
  }

  removeMember(id: string): Observable<void> {
    return this.http.delete<void>(`${API.team}/${id}`);
  }
}
