/**
 * Mariage FICTIF pour les tests automatiques et la démonstration (`pnpm demo-wedding`).
 * Aucune donnée réelle : les vraies informations sont saisies dans l'assistant d'installation.
 */
import type { SetupInput } from './wedding.service';

export const DEMO_WEDDING: SetupInput = {
  partner1First: 'Camille',
  partner1Last: 'Martin',
  partner2First: 'Alex',
  partner2Last: 'Hoarau',
  weddingDate: '2027-06-12',
  ceremonyTime: '15:00',
  receptionTime: '18:00',
  venueName: 'Église Saint-Pierre',
  venueCity: 'Saint-Pierre',
  venueRegion: 'La Réunion',
  receptionPlace: 'Domaine des Lilas',
  contactEmail: 'contact@mariage.test',
  contactPhone: '+262692000000',
  contactPhoneLabel: 'Témoins',
  privacyEmail: 'contact@mariage.test',
  rsvpDeadline: '2027-05-25',
};
