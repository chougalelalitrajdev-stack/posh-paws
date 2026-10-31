import { Injectable, signal } from '@angular/core';
import { Pet } from '../models/pet.model';

export type PetDialogStep = 'basics' | 'about' | 'care';

/** UI state for the global add/edit-pet dialog. */
@Injectable({ providedIn: 'root' })
export class PetDialogService {
  readonly isOpen = signal(false);
  readonly step = signal<PetDialogStep>('basics');
  readonly editing = signal<Pet | null>(null);

  /** Opens the dialog to add a pet, or to edit one when a pet is passed. */
  open(pet?: Pet): void {
    this.editing.set(pet ?? null);
    this.step.set('basics');
    this.isOpen.set(true);
  }

  close(): void {
    this.isOpen.set(false);
  }

  goTo(step: PetDialogStep): void {
    this.step.set(step);
  }
}
