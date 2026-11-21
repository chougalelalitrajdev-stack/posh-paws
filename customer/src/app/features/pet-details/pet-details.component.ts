import { Component, ChangeDetectionStrategy, computed, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { PetDialogService } from '../../core/services/pet-dialog.service';
import { PetService } from '../../core/services/pet.service';
import { VaccinationStatus } from '../../core/models/pet.model';
import { COAT_LABELS, PET_EMOJI, PET_GENDER_OPTIONS, PET_TEMPERAMENT_OPTIONS, VACCINATION_OPTIONS } from '../../core/constants/pet.constants';
import { isPriced, optionLabel, petAgeLabel } from '../../core/utils/pet.utils';

const VACCINATION_ICON: Record<VaccinationStatus, string> = {
  'up-to-date': '✓',
  'due-soon': '⏰',
  'not-vaccinated': '⚠',
  unknown: '?',
};

@Component({
  selector: 'pp-pet-details',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pet-details.component.html',
  styleUrl: './pet-details.component.scss',
})
export class PetDetailsComponent {
  private router = inject(Router);
  private petDialog = inject(PetDialogService);
  protected petService = inject(PetService);

  /** Bound from the `:id` route param. */
  readonly id = input.required<string>();

  protected readonly emoji = PET_EMOJI;
  protected readonly vaccinationIcon = VACCINATION_ICON;

  protected pet = computed(() => this.petService.pets().find(p => p.id === this.id()));

  protected age = computed(() => petAgeLabel(this.pet()?.birthDate));
  protected gender = computed(() => optionLabel(PET_GENDER_OPTIONS, this.pet()?.gender));
  protected weight = computed(() => (this.pet()?.weightKg ? `${this.pet()!.weightKg} kg` : undefined));
  protected coat = computed(() => (this.pet()?.coatType ? COAT_LABELS[this.pet()!.coatType!] : undefined));
  /** Added before breed, weight and coat were asked for: they're needed before the next booking. */
  protected needsDetails = computed(() => { const p = this.pet(); return !!p && !isPriced(p); });
  protected vaccination = computed(() => optionLabel(VACCINATION_OPTIONS, this.pet()?.vaccination));
  protected temperament = computed(() =>
    (this.pet()?.temperament ?? []).map(t => optionLabel(PET_TEMPERAMENT_OPTIONS, t) ?? t),
  );

  protected facts = computed(() =>
    [
      { label: 'Gender', value: this.gender() },
      { label: 'Age', value: this.age() },
      { label: 'Weight', value: this.weight() },
      { label: 'Coat', value: this.coat() },
    ].filter(f => !!f.value),
  );

  protected isSparse = computed(() => {
    const p = this.pet();
    return !!p && !this.needsDetails() && !p.gender && !p.birthDate && !p.vaccination && p.temperament.length === 0 && !p.notes;
  });

  book(): void {
    const pet = this.pet();
    if (pet) void this.router.navigate(['/book'], { queryParams: { pet: pet.type, petId: pet.id } });
  }

  edit(): void {
    const pet = this.pet();
    if (pet) this.petDialog.open(pet);
  }
}
