import { Component, ChangeDetectionStrategy, input, model } from '@angular/core';

/** On/off toggle (role="switch"). Always give it a label for screen readers. */
@Component({
  selector: 'pp-switch',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './switch.component.html',
  styleUrl: './switch.component.scss',
})
export class SwitchComponent {
  readonly checked = model(false);
  readonly label = input.required<string>();
  readonly disabled = input(false);
}
