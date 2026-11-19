import { describe, expect, it } from 'vitest';
import { appLinkPath } from '../constants/content.constants';
import { AppLink } from '../models/content.model';
import { hoursSummary } from './date.utils';
import { paragraphs, telLink, whatsappLink } from './text.utils';

describe('admin content helpers', () => {
  it('splits admin text into paragraphs at blank lines', () => {
    expect(paragraphs('First line\nstill first.\n\n  Second.  \n\n\n')).toEqual(['First line\nstill first.', 'Second.']);
    expect(paragraphs(undefined)).toEqual([]);
  });

  it('builds Call and WhatsApp links from digits only, so nothing else can get into them', () => {
    expect(telLink('+91 98220 41763')).toBe('tel:+919822041763');
    expect(whatsappLink('98220 41763')).toBe('https://wa.me/919822041763');
    expect(whatsappLink('javascript:alert(1)')).toBeNull();
    expect(telLink('98220"><script>')).toBeNull();
    expect(whatsappLink('')).toBeNull();
  });

  it('lets a banner open only the app\'s own pages', () => {
    expect(appLinkPath('book')).toBe('/book');
    expect(appLinkPath('https://evil.example' as AppLink)).toBe('/');
  });

  it('sums up the opening hours, days in a row with the same hours together', () => {
    const week = [0, 1, 2, 3, 4, 5, 6].map(day => ({ day, open: day !== 6, opens: '09:00', closes: day === 5 ? '17:30' : '19:00' }));
    expect(hoursSummary(week)).toEqual(['Monday – Friday: 9 AM – 7 PM', 'Saturday: 9 AM – 5:30 PM', 'Sunday: Closed']);
  });
});
