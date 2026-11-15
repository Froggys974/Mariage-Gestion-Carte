import { describe, expect, it } from 'vitest';
import { groupNotes, nameKey, parseAgreement } from './invitations.service';

describe('traiteur', () => {
  it('regroupe les allergies identiques (casse, espaces)', () => {
    const groups = groupNotes([
      { family: 'Famille Payet', first: 'Léa', last: 'Payet', note: 'Allergie aux fruits de mer', table: '' },
      { family: 'Famille Lebon', first: 'Fabienne', last: 'Lebon', note: 'Sans porc', table: '' },
      {
        family: 'Famille Técher',
        first: 'Joël',
        last: 'Técher',
        note: 'allergie aux  fruits de mer',
        table: '',
      },
      { family: 'Famille Técher', first: 'Maëlle', last: 'Técher', note: '', table: '' },
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0]).toEqual({
      note: 'Allergie aux fruits de mer',
      people: ['Léa Payet (Famille Payet)', 'Joël Técher (Famille Técher)'],
    });
  });
});

describe('import : accord sous la chaise', () => {
  it('reconnaît le féminin', () => {
    expect(parseAgreement('Invitée')).toBe('invitee');
    expect(parseAgreement('F')).toBe('invitee');
    expect(parseAgreement('invité')).toBe('invite');
  });
});

describe('même prénom + nom', () => {
  it('ignore accents, majuscules, tirets et espaces en trop', () => {
    expect(nameKey('Marie-Ange', 'PAYET')).toBe('marie ange payet');
    expect(nameKey(' marie  ange ', 'Payet')).toBe(nameKey('Marie-Ange', 'Payet'));
    expect(nameKey('Joël', 'Técher')).toBe(nameKey('joel', 'techer'));
    expect(nameKey('Jean-Luc', "D'Eurveilher")).toBe(nameKey('Jean Luc', 'D’Eurveilher'));
    expect(nameKey('Marie', 'Payet')).not.toBe(nameKey('Marie', 'Hoarau'));
  });
});
