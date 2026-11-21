import { Component, ChangeDetectionStrategy, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { catchError, finalize, of } from 'rxjs';
import { VACCINATION_OPTIONS, isPriced } from '../../../core/constants/pet.constants';
import { CoatType, PetType } from '../../../core/models/catalog.model';
import { Customer, CustomerPet, PetDraft } from '../../../core/models/customer.model';
import { PetOwner } from '../../../core/models/pet.model';
import { CatalogService } from '../../../core/services/catalog.service';
import { CustomerService } from '../../../core/services/customer.service';
import { PetService } from '../../../core/services/pet.service';
import { formatPhone } from '../../../core/utils/contact.utils';
import { errorMessage } from '../../../core/utils/error.utils';
import { today } from '../../../core/utils/date.utils';
import { ModalComponent } from '../../../shared/components/modal/modal.component';

/**
 * Add a pet or edit one. With no `owner`, adding starts by finding the owner by phone.
 * Breed (from Catalog › Pet pricing), weight and coat are required: they set the price. Used by Pets, the customer profile and New booking.
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
  private catalog = inject(CatalogService);
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
    type: ['dog' as PetType],
    breedId: ['', Validators.required],
    weightKg: ['', [Validators.required, Validators.min(0.1), Validators.max(120)]],
    coatType: ['' as CoatType | '', Validators.required],
    birthDate: [''],
    gender: ['' as '' | 'male' | 'female'],
    temperament: [''],
    vaccination: ['unknown' as NonNullable<CustomerPet['vaccination']>],
    notes: [''],
    healthNotes: [''],
  });
  protected saving = signal(false);
  protected error = signal<string | null>(null);

  private type = toSignal(this.form.controls.type.valueChanges, { initialValue: 'dog' as PetType });
  /** The list for the pet type; a breed taken off the list since stays on offer for the pet that has it. */
  protected breeds = computed(() => {
    const listed = this.catalog.breedsFor(this.type());
    const p = this.pet();
    const kept = p?.breedId && p.type === this.type() && !listed.some(b => b.id === p.breedId);
    return kept ? [...listed, { id: p.breedId!, name: `${p.breed} (no longer listed)`, extraPaise: 0 }] : listed;
  });
  protected coats = computed(() => this.catalog.coatsFor(this.type()));
  protected priced = computed(() => { const p = this.pet(); return !p || isPriced(p); });

  constructor() {
    this.catalog.load().subscribe();
    // Switching dog ↔ cat clears a breed of the other kind.
    this.form.controls.type.valueChanges.subscribe(() => {
      if (!this.breeds().some(b => b.id === this.form.controls.breedId.value)) this.form.controls.breedId.setValue('');
    });
  }

  ngOnInit(): void {
    this.foundOwner.set(this.owner());
    const p = this.pet();
    if (p) {
      this.form.patchValue({
        ...p, breedId: p.breedId ?? '', birthDate: p.birthDate ?? '', gender: p.gender ?? '', weightKg: p.weightKg?.toString() ?? '',
        coatType: p.coatType ?? '', temperament: p.temperament ?? '', vaccination: p.vaccination ?? 'unknown', notes: p.notes ?? '', healthNotes: p.healthNotes ?? '',
      });
    }
  }

  findOwner(): void {
    if (this.ownerPhone.invalid) {
      this.ownerPhone.markAsTouched();
      return;
    }
    this.lookup.set('searching');
    this.customerService.findByPhone(this.ownerPhone.value).pipe(catchError(() => of(null))).subscribe((c: Customer | null) => {
      this.foundOwner.set(c ? { id: c.id, name: c.name, phone: c.phone } : null);
      this.lookup.set(c ? 'idle' : 'not-found');
    });
  }

  save(): void {
    const owner = this.foundOwner();
    if (this.form.invalid || !owner || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    const v = this.form.getRawValue();
    const draft: PetDraft = {
      ...v,
      gender: v.gender || undefined,
      weightKg: Number(v.weightKg),
      coatType: v.coatType || null,
    };
    const p = this.pet();
    (p ? this.petService.update(p.id, draft) : this.petService.add(owner.id, draft))
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({ next: saved => this.saved.emit(saved), error: e => this.error.set(errorMessage(e)) });
  }
}
