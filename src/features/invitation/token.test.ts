import { describe, expect, it } from 'vitest';
import { generateToken, isTokenShape, personalLink } from './token';

describe('token', () => {
  it('fait 128 bits en base64url (22 caractères)', () => {
    const t = generateToken();
    expect(t).toHaveLength(22);
    expect(isTokenShape(t)).toBe(true);
    expect(Buffer.from(t, 'base64url')).toHaveLength(16);
  });
  it('est unique', () => {
    const set = new Set(Array.from({ length: 1000 }, generateToken));
    expect(set.size).toBe(1000);
  });
  it('rejette les formes invalides', () => {
    expect(isTokenShape('a7k2x9')).toBe(false);
    expect(isTokenShape('../../etc/passwd/xxxxxx')).toBe(false);
  });
  it('construit le lien personnel', () => {
    expect(personalLink('https://m.re', 'abc')).toBe('https://m.re/i/abc');
  });
});
