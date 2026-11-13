/**
 * RGPD : les allergies (données de santé) et les coordonnées sont effacées automatiquement
 * à la date site_settings.purge_at (par défaut 19/03/2027, 3 mois après le mariage).
 * Les noms sont conservés (souvenir du plan de table).
 */
import { eq, isNotNull, sql } from 'drizzle-orm';
import type { Db } from '~/lib/db/client';
import { guest, invitation, messageJob, otpChallenge, sendLog, siteSettings } from '~/lib/db/schema';
import { logger } from '~/lib/logger';
import { getSiteSettings } from '../card/card.service';

export function purgeDue(purgeAt: Date, purgedAt: Date | null, now = new Date()): boolean {
  return !purgedAt && now.getTime() >= purgeAt.getTime();
}

export async function runPurgeIfDue(db: Db, now = new Date()): Promise<boolean> {
  const s = await getSiteSettings(db);
  if (!purgeDue(s.purgeAt, s.purgedAt, now)) return false;
  await purgeNow(db);
  return true;
}

export async function purgeNow(db: Db): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.update(guest).set({ notes: null }).where(isNotNull(guest.notes));
    await tx
      .update(invitation)
      .set({ email: null, phoneE164: null, draft: null, draftUpdatedAt: null })
      .where(eq(invitation.kind, 'guest'));
    await tx.update(sendLog).set({ error: null });
    await tx.delete(messageJob);
    await tx.delete(otpChallenge);
    await tx
      .update(siteSettings)
      .set({ purgedAt: sql`now()` })
      .where(eq(siteSettings.id, 1));
  });
  logger.info('RGPD : allergies et coordonnées effacées');
}
