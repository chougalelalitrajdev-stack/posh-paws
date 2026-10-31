import { Component, ChangeDetectionStrategy, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { errorMessage } from '../../../core/utils/error.utils';
import { MOCK_PASSWORD, STAFF } from '../../../core/mocks/mock-data';
import { ROLE_LABELS } from '../../../core/constants/app.constants';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { environment } from '../../../../environments/environment';

/** Staff sign-in (email + password), from the admin design. */
@Component({
  selector: 'pp-login',
  imports: [ReactiveFormsModule, RouterLink, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private auth = inject(AuthService);
  private router = inject(Router);

  /** Query param: where to go after signing in. */
  readonly returnUrl = input<string>();

  protected form = inject(NonNullableFormBuilder).group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
    remember: [true],
  });
  protected showPassword = signal(false);
  protected submitting = signal(false);
  protected error = signal<string | null>(null);

  /** Demo accounts, shown only while the mock backend is on. */
  protected readonly demoAccounts = environment.useMocks
    ? STAFF.map(s => ({ email: s.email, role: ROLE_LABELS[s.role] }))
    : [];
  protected readonly demoPassword = MOCK_PASSWORD;

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (this.submitting()) return;

    const { email, password, remember } = this.form.getRawValue();
    this.submitting.set(true);
    this.error.set(null);
    try {
      await this.auth.login(email, password, remember);
      await this.router.navigateByUrl(this.safeReturnUrl());
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.submitting.set(false);
    }
  }

  useDemo(email: string): void {
    this.form.patchValue({ email, password: this.demoPassword });
  }

  protected invalid(name: 'email' | 'password'): boolean {
    const control = this.form.controls[name];
    return control.invalid && control.touched;
  }

  /** Only follow in-app paths, never a full URL from the query string. */
  private safeReturnUrl(): string {
    const url = this.returnUrl();
    return url && url.startsWith('/') && !url.startsWith('//') ? url : '/';
  }
}
