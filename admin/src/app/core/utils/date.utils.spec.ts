import { describe, expect, it } from 'vitest';
import { addDays, ageLabel, agoLabel, dateRange, petAge, shortDate, timeRange, toIsoDate, whenLabel } from './date.utils';

describe('date utils', () => {
  it('formats local dates without shifting to UTC', () => {
    expect(toIsoDate(new Date(2026, 9, 27, 0, 30))).toBe('2026-10-27');
  });

  it('adds days across a month end', () => {
    expect(addDays('2026-10-30', 3)).toBe('2026-11-02');
    expect(dateRange('2026-10-31', 2)).toEqual(['2026-10-31', '2026-11-01']);
  });

  it('labels time ranges in 24h', () => {
    expect(timeRange('12:00', 120)).toBe('12:00–14:00');
    expect(timeRange('17:30', 45)).toBe('17:30–18:15');
  });

  it('describes ages and moments relative to now', () => {
    const now = new Date(2026, 9, 27, 10, 0);
    expect(ageLabel(new Date(2026, 9, 27, 9, 18).toISOString(), now)).toBe('42 min');
    expect(ageLabel(new Date(2026, 9, 27, 8, 50).toISOString(), now)).toBe('1 h 10 min');
    expect(agoLabel(new Date(now.getTime() - 20_000).toISOString(), now)).toBe('just now');
    expect(agoLabel(new Date(2026, 9, 27, 9, 18).toISOString(), now)).toBe('42 min ago');
    expect(whenLabel(new Date(2026, 9, 27, 9, 12).toISOString(), now)).toBe('Today 09:12');
    expect(whenLabel(new Date(2026, 9, 26, 18, 5).toISOString(), now)).toBe('Yesterday 18:05');
  });

  it('formats short dates and pet ages like the design', () => {
    expect(shortDate('2026-10-29')).toBe('Thu 29 Oct');
    const now = new Date(2026, 9, 31);
    expect(petAge('2022-06-01', now)).toBe('4 yrs');
    expect(petAge('2026-02-10', now)).toBe('8 mo');
    expect(petAge('2025-10-31', now)).toBe('1 yr');
  });
});
