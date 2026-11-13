import { describe, expect, it } from 'vitest';
import { formatPhone, isE164, isReunionMobile, normalizePhone, waNumber } from './phone';

describe('normalizePhone (E.164)', () => {
  it.each([
    ['0692 11 22 33', '+262692112233'],
    ['0693445566', '+262693445566'],
    ['06.92.11.22.33', '+262692112233'],
    ['+262 692 11 22 33', '+262692112233'],
    ['+262 0692 11 22 33', '+262692112233'],
    ['00262 693 44 55 66', '+262693445566'],
    ['692 50 60 70', '+262692506070'],
    ['0262 27 00 00', '+262262270000'],
    ['0639 01 02 03', '+262639010203'],
    ['06 12 34 56 78', '+33612345678'],
    ['+33 6 12 34 56 78', '+33612345678'],
    ['+1 415 555 2671', '+14155552671'],
  ])('%s → %s', (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it.each(['', 'abc', '0692', '12345', '+0123456789', '06 XX XX XX XX', '0692 11 22 33 44'])(
    'rejette « %s »',
    (input) => {
      expect(normalizePhone(input)).toBeNull();
    },
  );
});

describe('helpers', () => {
  it('reconnaît un mobile réunionnais 692 / 693', () => {
    expect(isReunionMobile('+262692112233')).toBe(true);
    expect(isReunionMobile('+262693445566')).toBe(true);
    expect(isReunionMobile('+262262270000')).toBe(false);
    expect(isReunionMobile('+33612345678')).toBe(false);
  });
  it('valide le format E.164', () => {
    expect(isE164('+262692112233')).toBe(true);
    expect(isE164('0692112233')).toBe(false);
  });
  it('formate pour l’affichage et wa.me', () => {
    expect(formatPhone('+262692112233')).toBe('0692 11 22 33');
    expect(formatPhone('+33612345678')).toBe('06 12 34 56 78');
    expect(waNumber('+262692112233')).toBe('262692112233');
  });
});
