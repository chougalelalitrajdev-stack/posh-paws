import { Component, ChangeDetectionStrategy, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ROLE_LABELS, ROLE_MATRIX } from '../../../core/constants/app.constants';
import { StaffRole, TeamMember } from '../../../core/models/staff-user.model';
import { AlertService } from '../../../core/services/alert.service';
import { AuthService } from '../../../core/services/auth.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import { SettingsService } from '../../../core/services/settings.service';
import { agoLabel, minutesSince } from '../../../core/utils/date.utils';
import { errorMessage } from '../../../core/utils/error.utils';
import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { StatusPillComponent } from '../../../shared/components/status-pill/status-pill.component';

const ROLE_OPTIONS = (Object.keys(ROLE_LABELS) as StaffRole[]).map(value => ({ value, label: ROLE_LABELS[value] }));

/** Settings › Team & roles (Super Admin only): who can sign in, and what each role can do. */
@Component({
  selector: 'pp-team-settings',
  imports: [ReactiveFormsModule, AvatarComponent, ModalComponent, StatusPillComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './team-settings.component.html',
  styleUrl: './team-settings.component.scss',
})
export class TeamSettingsComponent {
  private settingsService = inject(SettingsService);
  private confirm = inject(ConfirmService);
  private alert = inject(AlertService);
  private auth = inject(AuthService);

  protected readonly roles = ROLE_OPTIONS;
  protected readonly roleLabels = ROLE_LABELS;
  protected readonly matrix = ROLE_MATRIX;
  protected meId = computed(() => this.auth.user()?.id);

  protected team = signal<TeamMember[]>([]);
  protected busyId = signal<string | null>(null);

  protected inviteOpen = signal(false);
  protected inviting = signal(false);
  protected inviteError = signal<string | null>(null);
  protected inviteForm = inject(NonNullableFormBuilder).group({
    name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    role: ['staff' as StaffRole],
  });

  constructor() {
    void this.load();
  }

  protected seen(m: TeamMember): string {
    if (m.id === this.meId()) return 'You';
    if (!m.lastSeenAt) return 'Never signed in';
    return minutesSince(m.lastSeenAt) < 5 ? 'Active now' : `Last seen ${agoLabel(m.lastSeenAt)}`;
  }

  async changeRole(m: TeamMember, e: Event): Promise<void> {
    const select = e.target as HTMLSelectElement;
    const role = select.value as StaffRole;
    const ok = await this.confirm.ask({
      title: `Make ${m.name} ${ROLE_LABELS[role]}?`,
      message: `They can do what the ${ROLE_LABELS[role]} column below allows, from their next sign-in.`,
      confirmLabel: `Make ${ROLE_LABELS[role]}`,
    });
    if (!ok) {
      select.value = m.role;
      return;
    }
    this.busyId.set(m.id);
    try {
      await this.settingsService.setRole(m.id, role);
      this.alert.success(`${m.name} is now ${ROLE_LABELS[role]}.`);
    } finally {
      this.busyId.set(null);
      await this.load();
    }
  }

  async remove(m: TeamMember): Promise<void> {
    const ok = await this.confirm.ask({
      title: `Remove ${m.name}?`, message: 'They can’t sign in any more. Their past work in bookings and notes stays.',
      confirmLabel: 'Remove', cancelLabel: 'Keep', tone: 'danger',
    });
    if (!ok) return;
    await this.settingsService.removeMember(m.id);
    await this.load();
    this.alert.success(`${m.name} removed from the team.`);
  }

  openInvite(): void {
    this.inviteForm.reset({ name: '', email: '', role: 'staff' });
    this.inviteError.set(null);
    this.inviteOpen.set(true);
  }

  async invite(): Promise<void> {
    if (this.inviteForm.invalid || this.inviting()) {
      this.inviteForm.markAllAsTouched();
      return;
    }
    this.inviting.set(true);
    this.inviteError.set(null);
    try {
      const m = await this.settingsService.invite(this.inviteForm.getRawValue());
      this.inviteOpen.set(false);
      await this.load();
      this.alert.success(`${m.name} added as ${ROLE_LABELS[m.role]}. Invitation emails start once the backend is live.`);
    } catch (e) {
      this.inviteError.set(errorMessage(e));
    } finally {
      this.inviting.set(false);
    }
  }

  private async load(): Promise<void> {
    this.team.set(await this.settingsService.team());
  }
}
