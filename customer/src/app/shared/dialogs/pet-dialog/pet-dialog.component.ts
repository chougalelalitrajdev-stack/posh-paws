import { Component, HostListener, computed, effect, inject, signal, untracked, ChangeDetectionStrategy } from '@angular/core';
import { finalize } from 'rxjs';
import { PetDialogService } from '../../../core/services/pet-dialog.service';
import { PetService } from '../../../core/services/pet.service';
import { CoatType, PetDraft, PetGender, PetTemperament, PetType, VaccinationStatus } from '../../../core/models/pet.model';
import { PET_GENDER_OPTIONS, PET_TEMPERAMENT_OPTIONS, PET_TYPE_OPTIONS, VACCINATION_OPTIONS } from '../../../core/constants/pet.constants';
import { ageFromBirthDate, birthDateFromAge } from '../../../core/utils/pet.utils';
import { errorMessage } from '../../../core/utils/error.utils';
import { ChipGroupComponent } from '../../components/chip-group/chip-group.component';

const MAX_YEARS = 30;
const MAX_KG = 120;

/**
 * Add or edit a pet in three short steps. The first asks what sets the price: dog or cat, name, breed (from the shop's list),
 * weight and coat (each coat with the shop's note that helps pick it). The rest (age, gender, temperament, health) is optional.
 */
@Component({
  selector: 'pp-pet-dialog',
  imports: [ChipGroupComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pet-dialog.component.html',
  styleUrl: './pet-dialog.component.scss',
})
export class PetDialogComponent {
  protected dialog = inject(PetDialogService);
  private pets = inject(PetService);

  protected readonly typeOptions = PET_TYPE_OPTIONS;
  protected readonly genderOptions = PET_GENDER_OPTIONS;
  protected readonly temperamentOptions = PET_TEMPERAMENT_OPTIONS;
  protected readonly vaccinationOptions = VACCINATION_OPTIONS;
  protected readonly steps = ['basics', 'about', 'care'] as const;

  protected type = signal<PetType | null>(null);
  protected name = signal('');
  protected breedId = signal('');
  protected weight = signal('');
  protected coatType = signal<CoatType | null>(null);
  protected years = signal(0);
  protected months = signal(0);
  protected gender = signal<PetGender | null>(null);
  protected temperament = signal<PetTemperament[]>([]);
  protected vaccination = signal<VaccinationStatus | null>(null);
  protected notes = signal('');
  protected submitting = signal(false);
  protected error = signal<string | null>(null);

  protected isEditing = computed(() => this.dialog.editing() !== null);
  protected weightOk = computed(() => {
    const kg = Number(this.weight());
    return this.weight() !== '' && kg > 0 && kg <= MAX_KG;
  });
  protected canSave = computed(() =>
    this.type() !== null && this.name().trim().length > 0 && !!this.breedId() && this.weightOk() && this.coatType() !== null);
  /** The shop's breeds for the pet type; a breed taken off the list since stays on offer for the pet that has it. */
  protected breedOptions = computed(() => {
    const listed = this.pets.options()?.[this.type() ?? 'dog'].breeds ?? [];
    const p = this.dialog.editing();
    const kept = p?.breedId && p.type === this.type() && !listed.some(b => b.id === p.breedId);
    return kept ? [...listed, { id: p.breedId!, name: `${p.breed} (no longer listed)` }] : listed;
  });
  protected coatOptions = computed(() => this.pets.options()?.[this.type() ?? 'dog'].coats ?? []);
  /** Editing a pet added before breed, weight and coat were asked for. */
  protected missingDetails = computed(() => {
    const p = this.dialog.editing();
    return !!p && !(p.breedId && p.weightKg && p.coatType);
  });
  protected ageText = computed(() => {
    const y = this.years();
    const m = this.months();
    return y + m === 0 ? 'Not set' : [y && `${y} yr`, m && `${m} mo`].filter(Boolean).join(' ');
  });

  constructor() {
    this.pets.loadOptions().subscribe();
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

  save(): void {
    if (!this.canSave() || this.submitting()) return;
    this.submitting.set(true);
    this.error.set(null);
    const draft = this.buildDraft();
    const editing = this.dialog.editing();
    const request = editing ? this.pets.update({ ...draft, id: editing.id }) : this.pets.add(draft);
    request.pipe(finalize(() => this.submitting.set(false))).subscribe({
      next: () => this.dialog.close(),
      error: e => this.error.set(errorMessage(e, 'Could not save your pet. Please try again.')),
    });
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

  setType(type: PetType): void {
    this.type.set(type);
    if (!this.breedOptions().some(b => b.id === this.breedId())) this.breedId.set(''); // a breed of the other kind
  }

  onBreedChange(e: Event): void {
    this.breedId.set((e.target as HTMLSelectElement).value);
  }

  onWeightChange(e: Event): void {
    this.weight.set((e.target as HTMLInputElement).value);
  }

  onNotesChange(e: Event): void {
    this.notes.set((e.target as HTMLTextAreaElement).value);
  }

  private buildDraft(): PetDraft {
    const notes = this.notes().trim();
    const birthDate = birthDateFromAge({ years: this.years(), months: this.months() });
    return {
      type: this.type()!,
      name: this.name().trim(),
      breedId: this.breedId(),
      weightKg: Math.round(Number(this.weight()) * 10) / 10,
      coatType: this.coatType(),
      temperament: this.temperament(),
      ...(birthDate && { birthDate }),
      ...(this.gender() && { gender: this.gender()! }),
      ...(this.vaccination() && { vaccination: this.vaccination()! }),
      ...(notes && { notes }),
    };
  }

  private fillForm(): void {
    const pet = this.dialog.editing();
    const age = ageFromBirthDate(pet?.birthDate);
    this.type.set(pet?.type ?? null);
    this.name.set(pet?.name ?? '');
    this.breedId.set(pet?.breedId ?? '');
    this.weight.set(pet?.weightKg?.toString() ?? '');
    this.coatType.set(pet?.coatType ?? null);
    this.years.set(age?.years ?? 0);
    this.months.set(age?.months ?? 0);
    this.gender.set(pet?.gender ?? null);
    this.temperament.set(pet?.temperament ?? []);
    this.vaccination.set(pet?.vaccination ?? null);
    this.notes.set(pet?.notes ?? '');
    this.submitting.set(false);
    this.error.set(null);
  }
}
