import { Component, ChangeDetectionStrategy, OnInit, inject, input, output, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { VACCINATION_OPTIONS } from '../../../core/constants/pet.constants';
import { Customer, CustomerPet, PetDraft } from '../../../core/models/customer.model';
import { PetOwner } from '../../../core/models/pet.model';
import { CustomerService } from '../../../core/services/customer.service';
import { PetService } from '../../../core/services/pet.service';
import { formatPhone } from '../../../core/utils/contact.utils';
import { errorMessage } from '../../../core/utils/error.utils';
import { today } from '../../../core/utils/date.utils';
import { ModalComponent } from '../../../shared/components/modal/modal.component';

/**
 * Add a pet or edit one. With no `owner`, adding starts by finding the owner by phone.
 * Used by Pets and by the customer profile.
 */
@Component({
  selector: 'pp-pet-dialog',
  imports: [ReactiveFormsModule, ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pet-dialog.component.html',
  styleUrl: './pet-dialog.component.scss',
})
export class PetDialogComponent implements OnInit {
  private petService = inject(PetService);
  private customerService = inject(CustomerService);
  private fb = inject(NonNullableFormBuilder);

  /** null = add a new pet. */
  readonly pet = input<CustomerPet | null>(null);
  readonly owner = input<PetOwner | null>(null);
  readonly closed = output<void>();
  readonly saved = output<CustomerPet>();

  protected readonly vaccinationOptions = VACCINATION_OPTIONS;
  protected readonly maxDate = today();
  protected readonly formatPhone = formatPhone;

  protected ownerPhone = this.fb.control('', [Validators.required, Validators.pattern(/^\D*(\d\D*){10}$/)]);
  protected foundOwner = signal<PetOwner | null>(null);
  protected lookup = signal<'idle' | 'searching' | 'not-found'>('idle');

  protected form = this.fb.group({
    name: ['', Validators.required],
    type: ['dog' as 'dog' | 'cat'],
    breed: [''],
    birthDate: [''],
    gender: ['' as '' | 'male' | 'female'],
    weightKg: [''],
    coat: [''],
    temperament: [''],
    vaccination: ['unknown' as NonNullable<CustomerPet['vaccination']>],
    notes: [''],
    healthNotes: [''],
  });
  protected saving = signal(false);
  protected error = signal<string | null>(null);

  ngOnInit(): void {
    this.foundOwner.set(this.owner());
    const p = this.pet();
    if (p) {
      this.form.patchValue({
        ...p, breed: p.breed ?? '', birthDate: p.birthDate ?? '', gender: p.gender ?? '', weightKg: p.weightKg?.toString() ?? '',
        coat: p.coat ?? '', temperament: p.temperament ?? '', vaccination: p.vaccination ?? 'unknown', notes: p.notes ?? '', healthNotes: p.healthNotes ?? '',
      });
    }
  }

  async findOwner(): Promise<void> {
    if (this.ownerPhone.invalid) {
      this.ownerPhone.markAsTouched();
      return;
    }
    this.lookup.set('searching');
    const c: Customer | null = await this.customerService.findByPhone(this.ownerPhone.value).catch(() => null);
    this.foundOwner.set(c ? { id: c.id, name: c.name, phone: c.phone } : null);
    this.lookup.set(c ? 'idle' : 'not-found');
  }

  async save(): Promise<void> {
    const owner = this.foundOwner();
    if (this.form.invalid || !owner || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    try {
      const v = this.form.getRawValue();
      const draft: PetDraft = {
        ...v,
        gender: v.gender || undefined,
        weightKg: v.weightKg ? Number(v.weightKg) : undefined,
      };
      const p = this.pet();
      this.saved.emit(p ? await this.petService.update(p.id, draft) : await this.petService.add(owner.id, draft));
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.saving.set(false);
    }
  }
}
