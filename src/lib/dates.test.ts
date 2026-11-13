import { describe, expect, it } from 'vitest';
import { formatDayMonth, formatLongDate, fromDateInput, toDateInput } from './dates';

describe('dates', () => {
  it('écrit « 1er » pour le premier du mois', () => {
    expect(formatDayMonth(new Date('2026-12-01T23:59:59+04:00'))).toBe('1er décembre');
    expect(formatLongDate(new Date('2027-03-19T00:00:00+04:00'))).toBe('19 mars 2027');
  });
  it('fait l’aller-retour avec un champ date', () => {
    const d = fromDateInput('2026-12-01', true);
    expect(toDateInput(d)).toBe('2026-12-01');
    expect(d.toISOString()).toBe('2026-12-01T19:59:59.000Z');
  });
});
