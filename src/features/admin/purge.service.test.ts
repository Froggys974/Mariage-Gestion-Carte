import { describe, expect, it } from 'vitest';
import { addMonths, PURGE_MONTHS_AFTER } from '~/features/wedding/wedding';
import { purgeDue } from './purge.service';

describe('effacement RGPD', () => {
  it('a lieu 3 mois après le mariage par défaut', () => {
    expect(addMonths('2026-12-19', PURGE_MONTHS_AFTER)).toBe('2027-03-19');
  });
  it('ne se déclenche qu’une fois, à la date prévue', () => {
    const at = new Date('2027-03-19T00:00:00+04:00');
    expect(purgeDue(at, null, new Date('2027-03-18T12:00:00+04:00'))).toBe(false);
    expect(purgeDue(at, null, new Date('2027-03-19T00:00:01+04:00'))).toBe(true);
    expect(purgeDue(at, new Date('2027-03-19T01:00:00+04:00'), new Date('2027-04-01'))).toBe(false);
  });
});
