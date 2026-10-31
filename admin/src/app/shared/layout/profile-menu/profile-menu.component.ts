import { Component, ChangeDetectionStrategy, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import { ROLE_LABELS } from '../../../core/constants/app.constants';
import { AuthService } from '../../../core/services/auth.service';
import { IconComponent } from '../../components/icon/icon.component';

/** Avatar button in the top bar: who is signed in, their role, and Sign out. */
@Component({
  selector: 'pp-profile-menu',
  imports: [NgbDropdownModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './profile-menu.component.html',
  styleUrl: './profile-menu.component.scss',
})
export class ProfileMenuComponent {
  protected auth = inject(AuthService);
  private router = inject(Router);

  protected readonly roleLabels = ROLE_LABELS;
  protected initials = computed(() =>
    (this.auth.user()?.name ?? '')
      .split(/\s+/)
      .map(w => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase(),
  );

  signOut(): void {
    this.auth.logout();
    void this.router.navigate(['/login']);
  }
}
