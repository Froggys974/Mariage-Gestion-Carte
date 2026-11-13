import { describe, expect, it } from 'vitest';
import { scrubPath } from './logger';

describe('scrubPath', () => {
  it('masque le token des liens personnels', () => {
    expect(scrubPath('/i/AbCdEfGhIjKlMnOpQrStUv')).toBe('/i/:token');
    expect(scrubPath('/api/rsvp/AbCdEfGhIjKlMnOpQrStUv/draft')).toBe('/api/rsvp/:token/draft');
  });
  it('retire la query string', () => {
    expect(scrubPath('/admin?tab=plan')).toBe('/admin');
  });
});
