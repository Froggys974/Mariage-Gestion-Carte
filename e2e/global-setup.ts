/** Prépare la base de test (migrations, base vide, mariage fictif « Camille & Alex ») et démarre le worker d'envoi. */
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import postgres from 'postgres';
import { serverEnv } from '../playwright.config';

export const WORKER_PID_FILE = 'test-results/.worker-pid';

export default async function globalSetup(): Promise<void> {
  const env = { ...process.env, ...serverEnv };
  const sql = postgres(serverEnv.DATABASE_URL!, { onnotice: () => {} });
  await sql`select 1`;
  await sql.end();
  const m = spawnSync(process.execPath, ['dist/scripts/migrate.mjs'], { env, stdio: 'inherit' });
  if (m.status !== 0) throw new Error('migrations e2e en échec');
  const db = postgres(serverEnv.DATABASE_URL!, { onnotice: () => {} });
  await db`TRUNCATE invitation, guest, send_log, message_job, seating_plan, seating_table, seating_seat, otp_challenge, rate_limit_hit, admin_session, wedding CASCADE`;
  const d = spawnSync(process.execPath, ['dist/scripts/demo-wedding.mjs'], { env, stdio: 'inherit' });
  if (d.status !== 0) throw new Error('mariage de démonstration e2e en échec');
  await db`update site_settings set rsvp_deadline = '2099-01-01', public_rsvp_enabled = true, purged_at = null`;
  await db.end();
  const worker = spawn(process.execPath, ['dist/scripts/worker.mjs'], {
    env,
    stdio: 'ignore',
    detached: false,
  });
  mkdirSync('test-results', { recursive: true });
  writeFileSync(WORKER_PID_FILE, String(worker.pid ?? ''));
}
