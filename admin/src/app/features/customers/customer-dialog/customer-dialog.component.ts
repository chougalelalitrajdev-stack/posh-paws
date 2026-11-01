import { Component, ChangeDetectionStrategy, OnInit, inject, input, output, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { Customer } from '../../../core/models/customer.model';
import { CustomerService } from '../../../core/services/customer.service';
import { errorMessage } from '../../../core/utils/error.utils';
import { ModalComponent } from '../../../shared/components/modal/modal.component';

/** Add a customer, or edit one's contact details. */
@Component({
  selector: 'pp-customer-dialog',
  imports: [ReactiveFormsModule, ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './customer-dialog.component.html',
  styleUrl: './customer-dialog.component.scss',
})
export class CustomerDialogComponent implements OnInit {
  private customerService = inject(CustomerService);

  /** null = add a new customer. */
  readonly customer = input<Customer | null>(null);
  readonly closed = output<void>();
  readonly saved = output<Customer>();

  protected form = inject(NonNullableFormBuilder).group({
    name: ['', Validators.required],
    phone: ['', [Validators.required, Validators.pattern(/^\D*(\d\D*){10}$/)]],
    email: ['', Validators.email],
    area: [''],
  });
  protected saving = signal(false);
  protected error = signal<string | null>(null);

  ngOnInit(): void {
    const c = this.customer();
    if (c) this.form.patchValue({ name: c.name, phone: c.phone, email: c.email ?? '', area: c.area ?? '' });
  }

  protected invalid(name: 'name' | 'phone' | 'email'): boolean {
    const control = this.form.controls[name];
    return control.invalid && control.touched;
  }

  save(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    const details = this.form.getRawValue();
    const c = this.customer();
    (c ? this.customerService.update(c.id, details) : this.customerService.create(details))
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({ next: saved => this.saved.emit(saved), error: e => this.error.set(errorMessage(e)) });
  }
}
