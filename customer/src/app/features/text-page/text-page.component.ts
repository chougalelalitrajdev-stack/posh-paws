import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { PageKey } from '../../core/models/content.model';
import { ContentService } from '../../core/services/content.service';
import { paragraphs } from '../../core/utils/text.utils';
import { PageHeroComponent } from '../../shared/components/page-hero/page-hero.component';

/** A page of plain words from the admin (Content › Pages & FAQs): Terms of service, Privacy policy. Which one comes from the route. */
@Component({
  selector: 'pp-text-page',
  imports: [PageHeroComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './text-page.component.html',
  styleUrl: './text-page.component.scss',
})
export class TextPageComponent {
  protected readonly page = inject(ContentService).page(inject(ActivatedRoute).snapshot.data['page'] as PageKey);
  protected readonly paragraphs = paragraphs;
}
