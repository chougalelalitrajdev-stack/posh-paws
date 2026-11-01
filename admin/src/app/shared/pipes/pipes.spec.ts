import { describe, expect, it } from 'vitest';
import { DurationPipe } from './duration.pipe';
import { InrPipe } from './inr.pipe';

describe('pipes', () => {
  it('formats paise as rupees', () => {
    const inr = new InrPipe();
    expect(inr.transform(120000)).toBe('₹1,200');
    expect(inr.transform(null)).toBe('—');
  });

  it('formats durations the admin way', () => {
    const d = new DurationPipe();
    expect(d.transform(45)).toBe('45 min');
    expect(d.transform(90)).toBe('1 h 30 min');
    expect(d.transform(120)).toBe('2 h');
  });
});
