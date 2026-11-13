/**
 * Envoie un email de test avec la configuration SMTP du .env (noms et lieu : infos du mariage en base).
 * Usage : pnpm test-mail vous@example.re
 *         en production : docker compose exec app node scripts/run.mjs test-mail vous@example.re
 */
import { testEmail } from '../src/features/messaging/templates';
import { getWeddingLabels } from '../src/features/wedding/wedding.service';
import { closeDb, getDb } from '../src/lib/db/client';
import { getEnv } from '../src/lib/env';
import { SmtpEmailProvider } from '../src/lib/messaging/providers';

const to = process.argv[2];
if (!to || !to.includes('@')) {
  console.error('Indiquez une adresse : pnpm test-mail vous@example.re');
  process.exit(2);
}
const env = getEnv();
const provider = new SmtpEmailProvider();
try {
  const w = await getWeddingLabels(getDb());
  if (!w) throw new Error("le mariage n'est pas encore configuré (assistant de l'espace des mariés)");
  await provider.verify();
  const { messageId } = await provider.send({ to, ...testEmail(w, null) });
  console.log(`✓ Email envoyé à ${to} via ${env.SMTP_HOST}:${env.SMTP_PORT} (id ${messageId})`);
} catch (err) {
  console.error(`✗ Échec de l'envoi : ${(err as Error).message}`);
  process.exitCode = 1;
} finally {
  await closeDb();
}
