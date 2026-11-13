import { describe, expect, it } from 'vitest';
import { plain } from '~/content/fr';
import { buttonState, countFilled, initials, seatLabel, validSeat } from './rsvp-ui';

const base = { sent: false, declined: false, changed: false, closed: false };

describe('bouton d’envoi et texte d’aide (prototype)', () => {
  it('« Envoyer notre réponse » au départ', () => {
    const b = buttonState(base, '1er décembre');
    expect(b.label).toBe('Envoyer notre réponse');
    expect(plain(b.hint)).toMatch(/ne sont pas forcément celles du plan de table final/);
    expect(b.showDecline).toBe(true);
  });
  it('« Mettre à jour notre réponse » si l’invité modifie après l’envoi', () => {
    const b = buttonState({ ...base, sent: true, changed: true }, '1er décembre');
    expect(b.label).toBe('Mettre à jour notre réponse');
    expect(plain(b.hint)).toBe('Votre nouvelle réponse remplacera la précédente, sans doublon.');
  });
  it('« Réponse envoyée ✓ » une fois envoyé, avec la date limite', () => {
    const b = buttonState({ ...base, sent: true }, '1er décembre');
    expect(b.label).toBe('Réponse envoyée ✓');
    expect(plain(b.hint)).toMatch(/^Mersi ! Vous pouvez revenir .* jusqu'au 1er décembre\./);
  });
  it('balise « Mersi ! » en créole', () => {
    const b = buttonState({ ...base, sent: true }, '1er décembre');
    expect(Array.isArray(b.hint) && b.hint[0]).toEqual({ rcf: 'Mersi !' });
  });
  it('passe en lecture seule après la date limite', () => {
    const b = buttonState({ ...base, closed: true }, '1er décembre');
    expect(b.disabled).toBe(true);
    expect(b.showDecline).toBe(false);
  });
  it('après un déclin : on peut encore changer d’avis', () => {
    const b = buttonState({ ...base, declined: true }, '1er décembre');
    expect(b.label).toBe('Envoyer notre réponse');
    expect(b.showDecline).toBe(false);
  });
});

describe('chaises', () => {
  it('initiales en capitales', () => {
    expect(initials({ first: 'marie-ange', last: 'payet', note: '' })).toBe('MP');
    expect(initials({ first: 'Léa', last: '', note: '' })).toBe('L');
  });
  it('accorde la mention sous la chaise de l’invité principal', () => {
    const s = { first: 'Marie-Ange', last: 'Payet', note: '' };
    expect(seatLabel(s, true, 'invitee')).toBe('Marie-Ange Payet · invitée');
    expect(seatLabel(s, true, 'invite')).toBe('Marie-Ange Payet · invité');
    expect(seatLabel(s, false, 'invitee')).toBe('Marie-Ange Payet');
  });
  it('compte les places occupées', () => {
    expect(countFilled([{ first: 'a', last: '', note: '' }, null, null])).toBe(1);
  });
  it('exige un prénom ou un nom', () => {
    expect(validSeat('  ', '')).toBe(false);
    expect(validSeat('', 'Payet')).toBe(true);
  });
});
