import { Component, HostListener, computed, effect, inject, signal, untracked, ChangeDetectionStrategy } from '@angular/core';
import { PetDialogService } from '../../../core/pets/pet-dialog.service';
import { PetsService } from '../../../core/pets/pets.service';
import { PetDraft, PetCoat, PetGender, PetSize, PetTemperament, PetType, VaccinationStatus } from '../../../core/pets/pet.models';
import {
  BREEDS, PET_COAT_OPTIONS, PET_GENDER_OPTIONS, PET_SIZE_OPTIONS, PET_TEMPERAMENT_OPTIONS,
  PET_TYPE_OPTIONS, VACCINATION_OPTIONS,
} from '../../../core/pets/pet.options';
import { ageFromBirthDate, birthDateFromAge } from '../../../core/pets/pet.utils';
import { ChipGroupComponent } from '../../ui/chip-group/chip-group.component';

const MAX_YEARS = 30;
const GENERIC_ERROR = 'Could not save your pet. Please try again.';

@Component({
  selector: 'pp-pet-dialog',
  imports: [ChipGroupComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pet-dialog.component.html',
  styleUrl: './pet-dialog.component.scss',
})
export class PetDialogComponent {
  protected dialog = inject(PetDialogService);
  private pets = inject(PetsService);

  protected readonly typeOptions = PET_TYPE_OPTIONS;
  protected readonly genderOptions = PET_GENDER_OPTIONS;
  protected readonly sizeOptions = PET_SIZE_OPTIONS;
  protected readonly coatOptions = PET_COAT_OPTIONS;
  protected readonly temperamentOptions = PET_TEMPERAMENT_OPTIONS;
  protected readonly vaccinationOptions = VACCINATION_OPTIONS;
  protected readonly steps = ['basics', 'about', 'care'] as const;

  protected type = signal<PetType | null>(null);
  protected name = signal('');
  protected breed = signal('');
  protected years = signal(0);
  protected months = signal(0);
  protected gender = signal<PetGender | null>(null);
  protected size = signal<PetSize | null>(null);
  protected coat = signal<PetCoat | null>(null);
  protected temperament = signal<PetTemperament[]>([]);
  protected vaccination = signal<VaccinationStatus | null>(null);
  protected notes = signal('');
  protected submitting = signal(false);
  protected error = signal<string | null>(null);

  protected isEditing = computed(() => this.dialog.editing() !== null);
  protected canSave = computed(() => this.type() !== null && this.name().trim().length > 0);
  protected breedSuggestions = computed(() => BREEDS[this.type() ?? 'dog']);
  protected ageText = computed(() => {
    const y = this.years();
    const m = this.months();
    return y + m === 0 ? 'Not set' : [y && `${y} yr`, m && `${m} mo`].filter(Boolean).join(' ');
  });

  constructor() {
    effect(() => {
      if (this.dialog.isOpen()) untracked(() => this.fillForm());
    });
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.dialog.isOpen()) this.close();
  }

  close(): void {
    if (this.submitting()) return;
    this.dialog.close();
  }

  async save(): Promise<void> {
    if (!this.canSave() || this.submitting()) return;
    this.submitting.set(true);
    this.error.set(null);
    try {
      const draft = this.buildDraft();
      const editing = this.dialog.editing();
      if (editing) await this.pets.update({ ...draft, id: editing.id });
      else await this.pets.add(draft);
      this.dialog.close();
    } catch {
      this.error.set(GENERIC_ERROR);
    } finally {
      this.submitting.set(false);
    }
  }

  stepYears(delta: number): void {
    this.years.update(y => Math.min(MAX_YEARS, Math.max(0, y + delta)));
  }

  stepMonths(delta: number): void {
    this.months.update(m => Math.min(11, Math.max(0, m + delta)));
  }

  onNameChange(e: Event): void {
    this.name.set((e.target as HTMLInputElement).value);
  }

  onBreedChange(e: Event): void {
    this.breed.set((e.target as HTMLInputElement).value);
  }

  onNotesChange(e: Event): void {
    this.notes.set((e.target as HTMLTextAreaElement).value);
  }

  private buildDraft(): PetDraft {
    const breed = this.breed().trim();
    const notes = this.notes().trim();
    const birthDate = birthDateFromAge({ years: this.years(), months: this.months() });
    return {
      type: this.type()!,
      name: this.name().trim(),
      temperament: this.temperament(),
      ...(breed && { breed }),
      ...(birthDate && { birthDate }),
      ...(this.gender() && { gender: this.gender()! }),
      ...(this.size() && { size: this.size()! }),
      ...(this.coat() && { coat: this.coat()! }),
      ...(this.vaccination() && { vaccination: this.vaccination()! }),
      ...(notes && { notes }),
    };
  }

  private fillForm(): void {
    const pet = this.dialog.editing();
    const age = ageFromBirthDate(pet?.birthDate);
    this.type.set(pet?.type ?? null);
    this.name.set(pet?.name ?? '');
    this.breed.set(pet?.breed ?? '');
    this.years.set(age?.years ?? 0);
    this.months.set(age?.months ?? 0);
    this.gender.set(pet?.gender ?? null);
    this.size.set(pet?.size ?? null);
    this.coat.set(pet?.coat ?? null);
    this.temperament.set(pet?.temperament ?? []);
    this.vaccination.set(pet?.vaccination ?? null);
    this.notes.set(pet?.notes ?? '');
    this.submitting.set(false);
    this.error.set(null);
  }
}
