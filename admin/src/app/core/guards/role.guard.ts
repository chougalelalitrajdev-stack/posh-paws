import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { StaffRole } from '../models/staff-user.model';
import { AlertService } from '../services/alert.service';
import { AuthService } from '../services/auth.service';

/**
 * Lets only the given roles open a route:
 *   { path: 'settings', canActivate: [roleGuard('super_admin', 'admin')], ... }
 * Hiding the menu item is not enough; this blocks typed-in URLs too.
 */
export function roleGuard(...roles: StaffRole[]): CanActivateFn {
  return () => {
    if (inject(AuthService).hasRole(...roles)) return true;
    inject(AlertService).error("You don't have access to that page.");
    return inject(Router).createUrlTree(['/']);
  };
}
