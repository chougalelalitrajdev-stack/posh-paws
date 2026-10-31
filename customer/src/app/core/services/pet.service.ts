import { HttpClient } from '@angular/common/http';
import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';
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
    effect(() => {
      const userId = this.auth.user()?.id;
      untracked(() => void this.load(userId));
    });
  }

  /** The pet dialog shows save errors itself, so no global toast. */
  async add(draft: PetDraft): Promise<void> {
    const pet = await firstValueFrom(this.http.post<Pet>(API.pets, draft, { context: withoutErrorAlert() }));
    this._pets.update(list => [...list, pet]);
  }

  async update(pet: Pet): Promise<void> {
    const saved = await firstValueFrom(this.http.put<Pet>(`${API.pets}/${pet.id}`, pet, { context: withoutErrorAlert() }));
    this._pets.update(list => list.map(p => (p.id === saved.id ? saved : p)));
  }

  private async load(userId: string | undefined): Promise<void> {
    this._loaded.set(false);
    if (!userId) {
      this._pets.set([]);
      return;
    }
    this._loading.set(true);
    try {
      const pets = await firstValueFrom(this.http.get<Pet[]>(API.pets));
      if (this.auth.user()?.id === userId) {
        this._pets.set(pets);
        this._loaded.set(true);
      }
    } finally {
      this._loading.set(false);
    }
  }
}
