import { Component, ChangeDetectionStrategy, computed, effect, inject, signal } from '@angular/core';
import { FormArray, FormGroup, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { CATALOG_EDIT_ROLES } from '../../../core/constants/app.constants';
import { CoatType, PetPricing, PetType, PetTypePricing } from '../../../core/models/catalog.model';
import { AlertService } from '../../../core/services/alert.service';
import { AuthService } from '../../../core/services/auth.service';
import { CatalogService } from '../../../core/services/catalog.service';
import { errorMessage } from '../../../core/utils/error.utils';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { SegmentedComponent } from '../../../shared/components/segmented/segmented.component';

const TYPES = [{ value: 'dog', label: 'Dogs' }, { value: 'cat', label: 'Cats' }];

/**
 * Catalog › Pet pricing: what a pet's breed, weight and coat add (in whole rupees) to every service with
 * "Price depends on breed, weight and coat" on, the breed list both apps' pet forms offer, and the coat notes customers see.
 * Dogs and cats are saved together. The server works out every bill from these; this page only edits them.
 */
@Component({
  selector: 'pp-pet-pricing',
  imports: [ReactiveFormsModule, RouterLink, PageHeaderComponent, SegmentedComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pet-pricing.component.html',
  styleUrl: './pet-pricing.component.scss',
})
export class PetPricingComponent {
  protected catalog = inject(CatalogService);
  private auth = inject(AuthService);
  private alert = inject(AlertService);
  private fb = inject(NonNullableFormBuilder);

  protected readonly types = TYPES;
  protected canEdit = computed(() => this.auth.hasRole(...CATALOG_EDIT_ROLES));
  protected type = signal<string>('dog');
  protected form = this.fb.group({ dog: this.typeGroup(), cat: this.typeGroup() });
  protected saving = signal(false);
  protected error = signal<string | null>(null);

  protected current = computed(() => this.form.controls[this.type() as PetType]);

  constructor() {
    this.catalog.load().subscribe();
    // Fill the form once pet pricing has loaded (and again after a save from elsewhere), unless there are unsaved changes.
    // The template shows the form only once pet pricing is there, so it draws after this fills it.
    effect(() => {
      const doc = this.catalog.petPricing();
      if (doc && !this.form.dirty) this.fill(doc);
    });
  }

  protected breeds(): FormArray<FormGroup> { return this.current().controls.breeds as FormArray<FormGroup>; }
  protected bands(): FormArray<FormGroup> { return this.current().controls.weightBands as FormArray<FormGroup>; }
  protected coats(): FormArray<FormGroup> { return this.current().controls.coats as FormArray<FormGroup>; }

  /** "Up to 10 kg", "10–25 kg", "Over 40 kg", from the limits as typed. */
  protected bandLabel(i: number): string {
    const kg = (j: number) => this.bands().at(j)?.value.upToKg;
    if (i === this.bands().length - 1) return i === 0 ? 'Any weight' : `Over ${kg(i - 1) || '…'} kg`;
    return i === 0 ? 'Up to' : `${kg(i - 1) || '…'} kg to`;
  }

  addBand(): void {
    const last = this.bands().length - 1;
    const before = Number(this.bands().at(last - 1)?.value.upToKg ?? 0);
    this.bands().insert(last, this.band({ upToKg: before + 10, extraPaise: 0 }));
    this.form.markAsDirty();
  }

  removeBand(i: number): void {
    this.bands().removeAt(i);
    this.form.markAsDirty();
  }

  addBreed(): void {
    this.breeds().push(this.breed({ id: null, name: '', extraPaise: 0 }));
    this.form.markAsDirty();
  }

  removeBreed(i: number): void {
    this.breeds().removeAt(i);
    this.form.markAsDirty();
  }

  discard(): void {
    const doc = this.catalog.petPricing();
    if (doc) this.fill(doc);
    this.error.set(null);
  }

  save(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      this.error.set('Fill in every breed name, weight and extra (₹0 or more) on both Dogs and Cats.');
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    this.catalog.savePetPricing({ dog: this.typeDoc('dog'), cat: this.typeDoc('cat') })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: saved => {
          this.fill(saved);
          this.alert.success('Pet pricing saved. New bookings use it.');
        },
        error: e => this.error.set(errorMessage(e)),
      });
  }

  // ── Form ↔ pricing (rupees on screen, paise on the wire) ──

  private typeGroup() {
    return this.fb.group({ breeds: this.fb.array<FormGroup>([]), weightBands: this.fb.array<FormGroup>([]), coats: this.fb.array<FormGroup>([]) });
  }

  private rupees(paise: number) {
    return this.fb.control(paise / 100, [Validators.required, Validators.min(0), Validators.max(10000)]);
  }

  private breed(b: { id: string | null; name: string; extraPaise: number }): FormGroup {
    return this.fb.group({ id: [b.id as string | null], name: [b.name, Validators.required], extra: this.rupees(b.extraPaise) });
  }

  private band(b: { upToKg: number | null; extraPaise: number }): FormGroup {
    return this.fb.group({ upToKg: [b.upToKg as number | null, b.upToKg === null ? [] : [Validators.required, Validators.min(0.1)]], extra: this.rupees(b.extraPaise) });
  }

  private fill(doc: PetPricing): void {
    for (const t of ['dog', 'cat'] as PetType[]) {
      const g = this.form.controls[t].controls;
      g.breeds.clear();
      doc[t].breeds.forEach(b => g.breeds.push(this.breed(b)));
      g.weightBands.clear();
      doc[t].weightBands.forEach(b => g.weightBands.push(this.band(b)));
      g.coats.clear();
      doc[t].coats.forEach(c => g.coats.push(this.fb.group({ type: [c.type], label: [c.label], note: [c.note], extra: this.rupees(c.extraPaise) })));
    }
    this.form.markAsPristine();
    if (!this.canEdit()) this.form.disable();
  }

  private typeDoc(t: PetType): PetTypePricing {
    const v = this.form.controls[t].getRawValue() as {
      breeds: { id: string | null; name: string; extra: number }[];
      weightBands: { upToKg: number | null; extra: number }[];
      coats: { type: CoatType; label: string; note: string; extra: number }[];
    };
    const paise = (rupees: number) => Math.round(Number(rupees)) * 100;
    return {
      breeds: v.breeds.map(b => ({ id: b.id, name: b.name.trim(), extraPaise: paise(b.extra) })),
      weightBands: v.weightBands.map((b, i, all) => ({ upToKg: i === all.length - 1 ? null : Number(b.upToKg), extraPaise: paise(b.extra) })),
      coats: v.coats.map(c => ({ type: c.type, label: c.label, note: c.note.trim(), extraPaise: paise(c.extra) })),
    };
  }
}
