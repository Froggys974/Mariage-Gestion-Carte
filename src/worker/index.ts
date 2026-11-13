/**
 * Worker : file d'envoi (1 message par seconde, réessais espacés) et tâches planifiées
 * (nettoyage des traces anti-abus, sessions expirées, codes expirés, purge RGPD).
 */
import { lt } from 'drizzle-orm';
import { purgeExpiredSessions } from '../lib/auth/session';
import { closeDb, getDb } from '../lib/db/client';
import { otpChallenge } from '../lib/db/schema';
import { getEnv, type Env } from '../lib/env';
import { logger } from '../lib/logger';
import { getEmailProvider, getWhatsAppProvider } from '../lib/messaging/providers';
import { purgeOldHits } from '../lib/rate-limit';
import { runPurgeIfDue } from '../features/admin/purge.service';
import { processNext } from '../features/messaging/worker-core';

const MAINTENANCE_EVERY_MS = 60 * 60_000;

let env: Env;
try {
  env = getEnv();
} catch (err) {
  console.error((err as Error).message);
  process.exit(1);
}

const db = getDb();
const deps = { email: getEmailProvider(), whatsapp: getWhatsAppProvider() };
let stopping = false;
let lastMaintenance = 0;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function maintenance(): Promise<void> {
  await purgeOldHits(db);
  await purgeExpiredSessions(db);
  await db.delete(otpChallenge).where(lt(otpChallenge.expiresAt, new Date(Date.now() - 24 * 60 * 60_000)));
  await runPurgeIfDue(db);
}

async function main(): Promise<void> {
  logger.info(
    { email: deps.email.name, whatsapp: deps.whatsapp.name, intervalMs: env.WORKER_SEND_INTERVAL_MS },
    'worker démarré',
  );
  while (!stopping) {
    try {
      if (Date.now() - lastMaintenance > MAINTENANCE_EVERY_MS) {
        lastMaintenance = Date.now();
        await maintenance();
      }
      await processNext(db, deps);
    } catch (err) {
      logger.error({ err }, 'worker : erreur');
    }
    await sleep(env.WORKER_SEND_INTERVAL_MS);
  }
  await closeDb();
}

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => {
    stopping = true;
    logger.info({ sig }, 'worker : arrêt demandé');
  });
}

void main();
