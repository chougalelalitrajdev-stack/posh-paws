import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { Pet, PetDraft } from './pet.models';
import { PetsProvider } from './pets.provider';

/** The logged-in user's pets. Reloads on login and clears on logout. */
@Injectable({ providedIn: 'root' })
export class PetsService {
  private provider = inject(PetsProvider);
  private auth = inject(AuthService);

  private readonly _pets = signal<Pet[]>([]);
  private readonly _loading = signal(false);
  private readonly _loaded = signal(false);

  readonly pets = this._pets.asReadonly();
  readonly loading = this._loading.asReadonly();
  /** True once the current user's pets have been fetched at least once. */
  readonly loaded = this._loaded.asReadonly();

  constructor() {
    effect(() => {
      const ownerId = this.auth.user()?.id;
      untracked(() => void this.load(ownerId));
    });
  }

  async add(draft: PetDraft): Promise<void> {
    const pet = await this.provider.create(this.requireOwnerId(), draft);
    this._pets.update(list => [...list, pet]);
  }

  async update(pet: Pet): Promise<void> {
    const saved = await this.provider.update(this.requireOwnerId(), pet);
    this._pets.update(list => list.map(p => (p.id === saved.id ? saved : p)));
  }

  private async load(ownerId: string | undefined): Promise<void> {
    this._loaded.set(false);
    if (!ownerId) {
      this._pets.set([]);
      return;
    }
    this._loading.set(true);
    try {
      const pets = await this.provider.list(ownerId);
      if (this.auth.user()?.id === ownerId) {
        this._pets.set(pets);
        this._loaded.set(true);
      }
    } finally {
      this._loading.set(false);
    }
  }

  private requireOwnerId(): string {
    const id = this.auth.user()?.id;
    if (!id) throw new Error('Must be logged in to manage pets.');
    return id;
  }
}
