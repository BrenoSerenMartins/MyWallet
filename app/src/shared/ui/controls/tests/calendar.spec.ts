import { describe, expect, it } from 'vitest';
import { displayDate, isoDate, parseDate, validDate } from '../control-utils';

describe('calendar values preserve ISO dates without timezone shifts', () => {
  it('accepts Brazilian input and existing ISO values', () => {
    expect(parseDate('29/02/2024')).toBe('2024-02-29');
    expect(parseDate('29022024')).toBe('2024-02-29');
    expect(parseDate('2026-11-04')).toBe('2026-11-04');
    expect(displayDate('2026-11-04')).toBe('04/11/2026');
  });
  it('rejects impossible and incomplete dates instead of normalizing silently', () => {
    for (const date of ['29/02/2026', '31/04/2026', '04/11', '2026-13-01', '2026-00-01']) {
      expect(parseDate(date)).toBeNull();
    }
    expect(validDate('2026-02-29')).toBe(false);
    expect(displayDate('invalid')).toBe('');
  });
  it('builds calendar padding cells across months, leap years and year boundaries', () => {
    expect(isoDate(2024, 2, 0)).toBe('2024-02-29');
    expect(isoDate(2026, 0, 0)).toBe('2025-12-31');
    expect(isoDate(2026, 11, 32)).toBe('2027-01-01');
    expect(isoDate(1, 0, 1)).toBe('0001-01-01');
    expect(validDate(isoDate(9999, 11, 32))).toBe(false);
  });
});
