/**
 * RGPD : état de l'effacement automatique (allergies + coordonnées), ou effacement immédiat.
 * Usage : pnpm purge          (affiche la date prévue)
 *         pnpm purge -- --now (efface tout de suite — irréversible)
 */
import { purgeNow } from '../src/features/admin/purge.service';
import { getSiteSettings } from '../src/features/card/card.service';
import { closeDb, getDb } from '../src/lib/db/client';
import { formatLongDate } from '../src/lib/dates';

const db = getDb();
try {
  const s = await getSiteSettings(db);
  if (process.argv.includes('--now')) {
    await purgeNow(db);
    console.log('✓ Allergies et coordonnées effacées.');
  } else if (s.purgedAt) {
    console.log(`Effacement déjà fait le ${formatLongDate(s.purgedAt)}.`);
  } else {
    console.log(`Effacement automatique prévu le ${formatLongDate(s.purgeAt)} (worker).`);
  }
} finally {
  await closeDb();
}
