import { Injectable } from '@angular/core';
import { Pet, PetDraft } from './pet.models';
import { PetsProvider } from './pets.provider';

const LATENCY_MS = 400;

/** Stand-in until a backend exists. Pets are stored per owner in localStorage. */
@Injectable()
export class MockPetsProvider extends PetsProvider {
  async list(ownerId: string): Promise<Pet[]> {
    await this.delay();
    return this.read(ownerId);
  }

  async create(ownerId: string, draft: PetDraft): Promise<Pet> {
    await this.delay();
    const pet: Pet = { ...draft, id: crypto.randomUUID() };
    this.write(ownerId, [...this.read(ownerId), pet]);
    return pet;
  }

  async update(ownerId: string, pet: Pet): Promise<Pet> {
    await this.delay();
    this.write(ownerId, this.read(ownerId).map(p => (p.id === pet.id ? pet : p)));
    return pet;
  }

  private delay(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, LATENCY_MS));
  }

  private key(ownerId: string): string {
    return `pp_mock_pets_${ownerId}`;
  }

  private read(ownerId: string): Pet[] {
    try {
      return JSON.parse(localStorage.getItem(this.key(ownerId)) ?? '[]');
    } catch {
      return [];
    }
  }

  private write(ownerId: string, pets: Pet[]): void {
    try {
      localStorage.setItem(this.key(ownerId), JSON.stringify(pets));
    } catch {
      // Storage unavailable — the mock just forgets the pets.
    }
  }
}
