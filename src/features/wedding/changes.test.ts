import { describe, expect, it } from 'vitest';
import { formValues, weddingChanges } from './changes';
import { DEMO_WEDDING } from './demo';
import type { WeddingInfo } from './wedding';

const { rsvpDeadline: _omit, ...base } = DEMO_WEDDING;
const before: WeddingInfo = formValues(base);

describe('récapitulatif des modifications (onglet « Mariage »)', () => {
  it('rien de changé : liste vide', () => {
    // le serveur renvoie le téléphone en +262… : même numéro, pas de modification
    expect(weddingChanges(before, formValues({ ...base }))).toEqual([]);
    expect(weddingChanges(before, { ...before, contactEmail: ' CONTACT@mariage.test ' })).toEqual([]);
  });
  it('liste chaque champ modifié avec l’ancienne et la nouvelle valeur, lisibles', () => {
    const after = formValues({
      ...base,
      venueName: 'Mairie de Saint-Denis',
      weddingDate: '2027-06-19',
      ceremonyTime: '16:30',
      contactPhone2: '+262693445566',
      contactPhone2Label: 'Marie (témoin)',
    });
    expect(weddingChanges(before, after)).toEqual([
      { label: 'Date du mariage', before: '12 juin 2027', after: '19 juin 2027' },
      { label: 'Heure de la cérémonie', before: '15h00', after: '16h30' },
      { label: 'Lieu de la cérémonie', before: 'Église Saint-Pierre', after: 'Mairie de Saint-Denis' },
      { label: 'Autre téléphone', before: '(vide)', after: '0693 44 55 66' },
      { label: 'Nom de la personne', before: '(vide)', after: 'Marie (témoin)' },
    ]);
  });
  it('un champ vidé s’affiche « (vide) »', () => {
    expect(weddingChanges(before, { ...before, receptionPlace: '' })).toEqual([
      { label: 'Lieu de la réception, s’il est différent', before: 'Domaine des Lilas', after: '(vide)' },
    ]);
  });
});
