import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { LoaderService } from '../../../core/services/loader.service';

/** Thin progress bar along the top of the page while API calls run. Mounted once in app.html. */
@Component({
  selector: 'pp-loader',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './loader.component.html',
  styleUrl: './loader.component.scss',
})
export class LoaderComponent {
  protected loader = inject(LoaderService);
}
