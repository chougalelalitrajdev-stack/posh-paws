import { describe, expect, it } from 'vitest';
import { DurationPipe } from './duration.pipe';
import { InrPipe } from './inr.pipe';

describe('InrPipe', () => {
  const pipe = new InrPipe();

  it('formats whole rupees without decimals', () => {
    expect(pipe.transform(120000)).toBe('₹1,200');
    expect(pipe.transform(49900)).toBe('₹499');
  });

  it('uses Indian digit grouping', () => {
    expect(pipe.transform(15000000)).toBe('₹1,50,000');
  });

  it('keeps paise when the amount is not whole rupees', () => {
    expect(pipe.transform(99950)).toBe('₹999.50');
  });
});

describe('DurationPipe', () => {
  const pipe = new DurationPipe();

  it('shows minutes below two hours', () => {
    expect(pipe.transform(20)).toBe('20 min');
    expect(pipe.transform(90)).toBe('90 min');
  });

  it('shows hours from two hours up', () => {
    expect(pipe.transform(120)).toBe('2 hrs');
    expect(pipe.transform(150)).toBe('2.5 hrs');
  });
});
