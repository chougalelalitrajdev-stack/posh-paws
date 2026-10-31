import { Component, ChangeDetectionStrategy, ElementRef, effect, inject, viewChild } from '@angular/core';
import { ConfirmService } from '../../../core/services/confirm.service';

/** Shows ConfirmService questions. Mounted once in app.html; Escape or the backdrop cancels. */
@Component({
  selector: 'pp-confirm-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './confirm-dialog.component.html',
  styleUrl: './confirm-dialog.component.scss',
  host: { '(document:keydown.escape)': 'cancel()' },
})
export class ConfirmDialogComponent {
  protected confirm = inject(ConfirmService);
  private confirmBtn = viewChild<ElementRef<HTMLButtonElement>>('confirmBtn');

  constructor() {
    // Move keyboard focus into the dialog when it opens.
    effect(() => this.confirmBtn()?.nativeElement.focus());
  }

  cancel(): void {
    if (this.confirm.request()) this.confirm.settle(false);
  }
}
