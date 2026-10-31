import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API } from '../constants/api-endpoints';
import { withoutErrorAlert } from '../interceptors/error.interceptor';
import { Closure, Settings, SettingsSection } from '../models/settings.model';
import { StaffRole, TeamMember } from '../models/staff-user.model';

/** Business settings, loaded once and shared (booking screens read the hold amount and slot rules); Settings edits them. Also the team. */
@Injectable({ providedIn: 'root' })
export class SettingsService {
  private http = inject(HttpClient);

  private readonly _settings = signal<Settings | null>(null);
  private loading: Promise<Settings> | null = null;

  readonly settings = this._settings.asReadonly();
  readonly holdPaise = computed(() => this._settings()?.payments.slotHoldPaise ?? 0);
  readonly linkHours = computed(() => this._settings()?.payments.linkExpiryHours ?? 0);
  /** Shown under the slot picker. */
  readonly rulesNote = computed(() => {
    const b = this._settings()?.booking;
    return b ? `Start times every ${b.slotStepMinutes} min, each with a station free for the whole service plus a ${b.bufferMinutes} min buffer. Breaks and closures are blocked.` : '';
  });

  /** Loads once; later calls reuse the same result. */
  load(): Promise<Settings> {
    this.loading ??= firstValueFrom(this.http.get<Settings>(API.settings))
      .then(s => {
        this._settings.set(s);
        return s;
      })
      .catch(e => {
        this.loading = null;
        throw e;
      });
    return this.loading;
  }

  /** Saves one section. The page shows errors itself. */
  async save<K extends SettingsSection>(section: K, value: Settings[K]): Promise<Settings> {
    return this.keep(await firstValueFrom(this.http.put<Settings>(`${API.settings}/${section}`, value, { context: withoutErrorAlert() })));
  }

  /** The dialog shows errors itself. */
  async addClosure(closure: Pick<Closure, 'date' | 'name' | 'closesAt'>): Promise<Settings> {
    await firstValueFrom(this.http.post<Closure>(`${API.settings}/closures`, closure, { context: withoutErrorAlert() }));
    return this.refresh();
  }

  async removeClosure(id: string): Promise<Settings> {
    return this.keep(await firstValueFrom(this.http.delete<Settings>(`${API.settings}/closures/${id}`)));
  }

  // ── Team & roles (Super Admin) ──

  team(): Promise<TeamMember[]> {
    return firstValueFrom(this.http.get<TeamMember[]>(API.team));
  }

  /** The dialog shows errors itself. */
  invite(member: { name: string; email: string; role: StaffRole }): Promise<TeamMember> {
    return firstValueFrom(this.http.post<TeamMember>(API.team, member, { context: withoutErrorAlert() }));
  }

  setRole(id: string, role: StaffRole): Promise<TeamMember> {
    return firstValueFrom(this.http.put<TeamMember>(`${API.team}/${id}`, { role }));
  }

  removeMember(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${API.team}/${id}`));
  }

  private async refresh(): Promise<Settings> {
    return this.keep(await firstValueFrom(this.http.get<Settings>(API.settings)));
  }

  private keep(s: Settings): Settings {
    this._settings.set(s);
    this.loading = Promise.resolve(s);
    return s;
  }
}
