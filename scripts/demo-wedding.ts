/**
 * Remplit l'assistant d'installation avec le mariage FICTIF de démonstration (Camille & Alex),
 * si le site n'est pas encore configuré. Sert aux tests e2e et à la démo ; jamais en production.
 * Usage : pnpm demo-wedding
 */
import { closeDb, getDb } from '../src/lib/db/client';
import { logger } from '../src/lib/logger';
import { DEMO_WEDDING } from '../src/features/wedding/demo';
import { getWedding, setupWedding } from '../src/features/wedding/wedding.service';

try {
  const db = getDb();
  if (await getWedding(db)) logger.info('mariage déjà configuré : rien à faire');
  else {
    await setupWedding(db, DEMO_WEDDING);
    logger.info('mariage de démonstration créé (Camille & Alex)');
  }
} catch (err) {
  logger.error({ err }, 'échec de la création du mariage de démonstration');
  process.exitCode = 1;
} finally {
  await closeDb();
}
