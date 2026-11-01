import { Component, ChangeDetectionStrategy, ElementRef, effect, input, output, viewChild } from '@angular/core';
import { IconComponent } from '../icon/icon.component';

/**
 * Dialog for small forms (Reschedule, Block time). Render it with @if; Escape,
 * the close button or the backdrop emit `closed`. Buttons go in with ppModalActions.
 */
@Component({
  selector: 'pp-modal',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './modal.component.html',
  styleUrl: './modal.component.scss',
  host: { '(document:keydown.escape)': 'closed.emit()' },
})
export class ModalComponent {
  readonly title = input.required<string>();
  readonly closed = output<void>();

  private dialog = viewChild.required<ElementRef<HTMLElement>>('dialog');

  constructor() {
    // Move keyboard focus into the dialog when it opens.
    effect(() => this.dialog().nativeElement.focus());
  }
}
