import { describe, expect, it } from 'vitest';
import { CatalogService } from './catalog.service';

describe('CatalogService', () => {
  const catalog = new CatalogService();

  it('returns services only for the requested pet type', () => {
    for (const type of ['dog', 'cat'] as const) {
      const list = catalog.servicesFor(type);
      expect(list.length).toBeGreaterThan(0);
      expect(list.every(s => s.petType === type)).toBe(true);
    }
  });

  it('stores every price as a whole number of paise', () => {
    const prices = [...catalog.servicesFor('dog'), ...catalog.servicesFor('cat'), ...catalog.plans].map(i => i.pricePaise);
    expect(prices.every(p => Number.isInteger(p) && p > 0)).toBe(true);
  });

  it('has exactly one featured plan and unique ids', () => {
    expect(catalog.plans.filter(p => p.featured)).toHaveLength(1);
    const ids = [...catalog.servicesFor('dog'), ...catalog.servicesFor('cat'), ...catalog.plans].map(i => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
