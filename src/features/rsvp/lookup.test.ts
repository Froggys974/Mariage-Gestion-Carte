import { describe, expect, it } from 'vitest';
import { generateCode, hashCode, pickCandidate } from './lookup.service';

describe('/rsvp : choix de l’invitation', () => {
  it('prend le meilleur candidat s’il est assez proche', () => {
    expect(pickCandidate([{ invitationId: 'a', score: 0.8 }])).toBe('a');
  });
  it('refuse un nom trop éloigné', () => {
    expect(pickCandidate([{ invitationId: 'a', score: 0.3 }])).toBeNull();
  });
  it('refuse un résultat ambigu (deux familles aussi proches)', () => {
    expect(
      pickCandidate([
        { invitationId: 'a', score: 0.7 },
        { invitationId: 'b', score: 0.66 },
      ]),
    ).toBeNull();
    expect(
      pickCandidate([
        { invitationId: 'a', score: 0.9 },
        { invitationId: 'b', score: 0.5 },
      ]),
    ).toBe('a');
  });
});

describe('code à 6 chiffres', () => {
  it('a toujours 6 chiffres', () => {
    for (let i = 0; i < 200; i++) expect(generateCode()).toMatch(/^\d{6}$/);
  });
  it('est haché avec l’identifiant du défi', () => {
    expect(hashCode('c1', '123456')).not.toBe(hashCode('c2', '123456'));
    expect(hashCode('c1', '123456')).not.toContain('123456');
  });
});
