import { Directive, TemplateRef, ViewContainerRef, effect, inject, input } from '@angular/core';
import { StaffRole } from '../../core/models/staff-user.model';
import { AuthService } from '../../core/services/auth.service';

/**
 * Renders its content only for the given roles:
 *   <button *ppHasRole="catalogEditors">Save</button>
 * Hiding a button is a convenience; the server still checks every change.
 */
@Directive({ selector: '[ppHasRole]' })
export class HasRoleDirective {
  private auth = inject(AuthService);
  private template = inject(TemplateRef<unknown>);
  private view = inject(ViewContainerRef);

  readonly ppHasRole = input.required<StaffRole[]>();

  private shown = false;

  constructor() {
    effect(() => {
      const allowed = this.auth.hasRole(...this.ppHasRole());
      if (allowed && !this.shown) this.view.createEmbeddedView(this.template);
      if (!allowed && this.shown) this.view.clear();
      this.shown = allowed;
    });
  }
}
