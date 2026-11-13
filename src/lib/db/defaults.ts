/**
 * Lignes uniques (carte, réglages) créées au premier démarrage, avec des valeurs neutres.
 * Les vraies valeurs (noms, date, lieu, date limite, effacement) sont écrites par l'assistant d'installation
 * (src/features/wedding/wedding.service.ts → setupWedding) : aucune information personnelle dans le code.
 */
import { card } from '../../content/fr';
import type { DbOrTx } from './client';
import { cardSettings, siteSettings } from './schema';

const DAY_MS = 86_400_000;
/** En attendant l'installation : réponses ouvertes 30 jours, effacement dans 6 mois. */
export const NEUTRAL_RSVP_DAYS = 30;
export const NEUTRAL_PURGE_DAYS = 180;

export async function ensureSingletons(db: DbOrTx): Promise<void> {
  await db
    .insert(cardSettings)
    .values({
      id: 1,
      names: '',
      dateLabel: '',
      place: '',
      ceremonyTime: '',
      receptionTime: '',
      message: card.defaultMessage,
    })
    .onConflictDoNothing();
  const now = Date.now();
  await db
    .insert(siteSettings)
    .values({
      id: 1,
      rsvpDeadline: new Date(now + NEUTRAL_RSVP_DAYS * DAY_MS),
      purgeAt: new Date(now + NEUTRAL_PURGE_DAYS * DAY_MS),
    })
    .onConflictDoNothing();
}
