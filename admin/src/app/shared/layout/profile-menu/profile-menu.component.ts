import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { Router } from '@angular/router';
import { NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import { ROLE_LABELS } from '../../../core/constants/app.constants';
import { AuthService } from '../../../core/services/auth.service';
import { AvatarComponent } from '../../components/avatar/avatar.component';
import { IconComponent } from '../../components/icon/icon.component';

/** Avatar button in the top bar: who is signed in, their role, and Sign out. */
@Component({
  selector: 'pp-profile-menu',
  imports: [NgbDropdownModule, IconComponent, AvatarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './profile-menu.component.html',
  styleUrl: './profile-menu.component.scss',
})
export class ProfileMenuComponent {
  protected auth = inject(AuthService);
  private router = inject(Router);

  protected readonly roleLabels = ROLE_LABELS;
  signOut(): void {
    this.auth.logout();
    void this.router.navigate(['/login']);
  }
}
