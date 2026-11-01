import { Component, ChangeDetectionStrategy, computed, inject, input, output } from '@angular/core';
import { AlertService } from '../../../core/services/alert.service';
import { formatPhone, whatsappLink } from '../../../core/utils/contact.utils';
import { IconComponent } from '../icon/icon.component';
import { ModalComponent } from '../modal/modal.component';

/**
 * Shows a ready message for a customer with "Open WhatsApp" and "Copy".
 * Until the backend sends WhatsApp messages itself, staff send them from here.
 */
@Component({
  selector: 'pp-share-dialog',
  imports: [ModalComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './share-dialog.component.html',
  styleUrl: './share-dialog.component.scss',
})
export class ShareDialogComponent {
  private alert = inject(AlertService);

  readonly title = input.required<string>();
  /** One line above the message, e.g. "Renewal link created for Ananya Desai." */
  readonly intro = input('');
  readonly phone = input.required<string>();
  readonly message = input.required<string>();
  readonly closed = output<void>();

  protected href = computed(() => whatsappLink(this.phone(), this.message()));
  protected to = computed(() => formatPhone(this.phone()));

  async copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.message());
      this.alert.success('Message copied.');
    } catch {
      this.alert.error('Could not copy. Select the message and copy it instead.');
    }
  }
}
