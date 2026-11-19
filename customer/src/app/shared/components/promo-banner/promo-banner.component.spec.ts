import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { Banner } from '../../../core/models/content.model';
import { PromoBannerComponent } from './promo-banner.component';

describe('PromoBannerComponent', () => {
  it('shows admin text as text: HTML or a script in it never runs (no XSS)', () => {
    (window as unknown as { hacked?: boolean }).hacked = false;
    const fixture = TestBed.configureTestingModule({ providers: [provideRouter([])] }).createComponent(PromoBannerComponent);
    const attack: Banner = {
      id: 'b', placement: 'home_promo', title: '<img src=x onerror="window.hacked=true">Sale', subtitle: '<script>window.hacked=true</script>',
      buttonText: 'Book', link: 'book', imageUrl: null, desktopImageUrl: null,
    };
    fixture.componentRef.setInput('banner', attack);
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.pp-promo-title')?.textContent).toBe(attack.title); // the tags show as plain characters
    expect(el.querySelector('.pp-promo-title img')).toBeNull();
    expect(el.querySelector('script')).toBeNull();
    expect((window as unknown as { hacked?: boolean }).hacked).toBe(false);
    expect(el.querySelector('a')?.getAttribute('href')).toBe('/book'); // the button opens the app's own page
  });
});
