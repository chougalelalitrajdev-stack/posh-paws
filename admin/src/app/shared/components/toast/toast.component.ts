import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { AlertService } from '../../../core/services/alert.service';

const ICONS = { success: '✓', error: '!', info: 'i' } as const;

/** Shows AlertService messages. Mounted once in app.html. */
@Component({
  selector: 'pp-toast',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './toast.component.html',
  styleUrl: './toast.component.scss',
})
export class ToastComponent {
  protected alertService = inject(AlertService);
  protected readonly icons = ICONS;
}
