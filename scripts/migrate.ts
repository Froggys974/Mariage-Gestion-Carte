/** Applique les migrations versionnées (dossier drizzle/) puis crée les lignes uniques. */
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { closeDb, getDb } from '../src/lib/db/client';
import { ensureSingletons } from '../src/lib/db/defaults';
import { logger } from '../src/lib/logger';

const started = Date.now();
try {
  const db = getDb();
  await migrate(db, { migrationsFolder: process.env.MIGRATIONS_DIR ?? './drizzle' });
  await ensureSingletons(db);
  logger.info({ ms: Date.now() - started }, 'migrations appliquées');
} catch (err) {
  logger.error({ err }, 'échec des migrations');
  process.exitCode = 1;
} finally {
  await closeDb();
}
