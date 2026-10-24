import { Pet, PetDraft } from './pet.models';

/** Backend port for pets. Bind a real implementation in app.config.ts when the API exists. */
export abstract class PetsProvider {
  abstract list(ownerId: string): Promise<Pet[]>;
  abstract create(ownerId: string, draft: PetDraft): Promise<Pet>;
  abstract update(ownerId: string, pet: Pet): Promise<Pet>;
}
