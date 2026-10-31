import { describe, expect, it } from 'vitest';
import { slotStart, timeLabel, timeRangeLabel, toIsoDate, upcomingDates } from './date.utils';

describe('booking utils', () => {
  it('formats local dates without shifting to UTC', () => {
    expect(toIsoDate(new Date(2025, 4, 9, 0, 30))).toBe('2025-05-09');
  });

  it('lists consecutive dates across a month end', () => {
    expect(upcomingDates(3, new Date(2025, 0, 30))).toEqual(['2025-01-30', '2025-01-31', '2025-02-01']);
  });

  it('builds a local start time', () => {
    const d = slotStart('2025-05-09', '14:30');
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()]).toEqual([2025, 4, 9, 14, 30]);
  });

  it('labels times in 12-hour form', () => {
    expect(timeLabel('09:00')).toBe('9:00 AM');
    expect(timeLabel('12:30')).toBe('12:30 PM');
    expect(timeRangeLabel('17:30', 90)).toBe('5:30 PM – 7:00 PM');
  });
});
