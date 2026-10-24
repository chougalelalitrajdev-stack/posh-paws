import { Component, ChangeDetectionStrategy, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BookingDialogService } from '../../core/services/booking-dialog.service';
import { PetDialogService } from '../../core/pets/pet-dialog.service';
import { PetsService } from '../../core/pets/pets.service';
import { VaccinationStatus } from '../../core/pets/pet.models';
import {
  PET_COAT_OPTIONS, PET_EMOJI, PET_GENDER_OPTIONS, PET_SIZE_OPTIONS, PET_TEMPERAMENT_OPTIONS,
  VACCINATION_OPTIONS, optionLabel,
} from '../../core/pets/pet.options';
import { petAgeLabel } from '../../core/pets/pet.utils';

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
  private bookingDialog = inject(BookingDialogService);
  private petDialog = inject(PetDialogService);
  protected petsService = inject(PetsService);

  /** Bound from the `:id` route param. */
  readonly id = input.required<string>();

  protected readonly emoji = PET_EMOJI;
  protected readonly vaccinationIcon = VACCINATION_ICON;

  protected pet = computed(() => this.petsService.pets().find(p => p.id === this.id()));

  protected age = computed(() => petAgeLabel(this.pet()?.birthDate));
  protected gender = computed(() => optionLabel(PET_GENDER_OPTIONS, this.pet()?.gender));
  protected size = computed(() => optionLabel(PET_SIZE_OPTIONS, this.pet()?.size));
  protected coat = computed(() => optionLabel(PET_COAT_OPTIONS, this.pet()?.coat));
  protected vaccination = computed(() => optionLabel(VACCINATION_OPTIONS, this.pet()?.vaccination));
  protected temperament = computed(() =>
    (this.pet()?.temperament ?? []).map(t => optionLabel(PET_TEMPERAMENT_OPTIONS, t) ?? t),
  );

  protected facts = computed(() =>
    [
      { label: 'Gender', value: this.gender() },
      { label: 'Age', value: this.age() },
      { label: 'Size', value: this.size() },
      { label: 'Coat', value: this.coat() },
    ].filter(f => !!f.value),
  );

  protected isSparse = computed(() => {
    const p = this.pet();
    return !!p && !p.breed && this.facts().length === 0 && !p.vaccination && p.temperament.length === 0 && !p.notes;
  });

  book(): void {
    const pet = this.pet();
    if (pet) this.bookingDialog.open({ petType: pet.type });
  }

  edit(): void {
    const pet = this.pet();
    if (pet) this.petDialog.open(pet);
  }
}
