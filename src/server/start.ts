/**
 * Point d'entrée de production : valide la configuration AVANT de démarrer le serveur Astro.
 * Une variable manquante arrête le processus avec un message clair.
 */
import { getEnv } from '../lib/env';
import { logger } from '../lib/logger';

try {
  const env = getEnv();
  process.env.HOST = env.HOST;
  process.env.PORT = String(env.PORT);
} catch (err) {
  console.error((err as Error).message);
  process.exit(1);
}

await import(new URL('./server/entry.mjs', import.meta.url).href);
logger.info({ port: process.env.PORT }, 'serveur démarré');
