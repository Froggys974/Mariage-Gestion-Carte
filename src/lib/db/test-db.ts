/** Outils pour les tests d'intégration (base jetable TEST_DATABASE_URL). */
import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { getDb } from './client';
import { DEMO_WEDDING } from '../../features/wedding/demo';
import { setupWedding } from '../../features/wedding/wedding.service';

export const hasTestDb = Boolean(process.env.TEST_DATABASE_URL);

export async function resetTestDb(): Promise<void> {
  const db = getDb();
  await migrate(db, { migrationsFolder: './drizzle' });
  await db.execute(
    sql`TRUNCATE invitation, guest, send_log, message_job, seating_plan, seating_table, seating_seat, otp_challenge, rate_limit_hit, admin_session, card_settings, site_settings, wedding CASCADE`,
  );
  await setupWedding(db, DEMO_WEDDING);
}
