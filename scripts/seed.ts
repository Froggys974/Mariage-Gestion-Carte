/**
 * Données de démonstration (familles du prototype). Idempotent ; `--reset` vide d'abord la base.
 * Les tokens sont déterministes pour pouvoir ouvrir les liens de démo (affichés à la fin).
 */
import { createHash, randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { closeDb, getDb } from '../src/lib/db/client';
import { ensureSingletons } from '../src/lib/db/defaults';
import { guest, invitation, seatingPlan, seatingTable, type InvitationStatus } from '../src/lib/db/schema';
import { getEnv } from '../src/lib/env';
import { fr } from '../src/content/fr';

export function demoToken(code: string): string {
  return createHash('sha256').update(`rcgn-demo-${code}`).digest().subarray(0, 16).toString('base64url');
}

interface Demo {
  code: string;
  first: string;
  last: string;
  email: string | null;
  phone: string | null;
  sentOn: string;
  status: InvitationStatus;
  agreement: 'invite' | 'invitee';
  party: Array<[string, string, string]>;
}

const DEMO: Demo[] = [
  {
    code: 'a7k2x9',
    first: 'Marie-Ange',
    last: 'Payet',
    email: 'ma.payet@example.re',
    phone: '+262692112233',
    sentOn: '2026-09-02',
    status: 'submitted',
    agreement: 'invitee',
    party: [
      ['Marie-Ange', 'Payet', ''],
      ['Jean-Luc', 'Payet', ''],
      ['Léa', 'Payet', 'Allergie aux fruits de mer'],
      ['Noah', 'Payet', ''],
    ],
  },
  {
    code: 'h2b5n7',
    first: 'Jean-Bernard',
    last: 'Hoarau',
    email: 'jb.hoarau@example.re',
    phone: null,
    sentOn: '2026-09-02',
    status: 'sent',
    agreement: 'invite',
    party: [],
  },
  {
    code: 'f3m8q1',
    first: 'Fabienne',
    last: 'Lebon',
    email: null,
    phone: '+262693445566',
    sentOn: '2026-09-05',
    status: 'submitted',
    agreement: 'invitee',
    party: [
      ['Fabienne', 'Lebon', 'Sans porc'],
      ['Patrick', 'Lebon', ''],
    ],
  },
  {
    code: 's6d1k4',
    first: 'Olivier',
    last: 'Sautron',
    email: 'o.sautron@example.re',
    phone: '+262692778899',
    sentOn: '2026-09-09',
    status: 'declined',
    agreement: 'invite',
    party: [],
  },
  {
    code: 'b8l3v6',
    first: 'Lucie',
    last: 'Bègue',
    email: 'lucie.begue@example.re',
    phone: null,
    sentOn: '2026-09-12',
    status: 'opened',
    agreement: 'invitee',
    party: [],
  },
  {
    code: 't9c4w2',
    first: 'Joël',
    last: 'Técher',
    email: 'joel.techer@example.re',
    phone: '+262692506070',
    sentOn: '2026-09-14',
    status: 'submitted',
    agreement: 'invite',
    party: [
      ['Joël', 'Técher', ''],
      ['Sandrine', 'Técher', ''],
      ['Maëlle', 'Técher', 'Végétarienne'],
    ],
  },
];

async function main(): Promise<void> {
  const db = getDb();
  if (process.argv.includes('--reset')) {
    await db.execute(
      sql`TRUNCATE invitation, guest, send_log, message_job, seating_plan, seating_table, seating_seat, otp_challenge, rate_limit_hit, admin_session, card_settings, site_settings, wedding CASCADE`,
    );
  }
  await ensureSingletons(db);

  // ordre inverse : la liste admin (plus récentes en premier) suit le prototype
  for (const d of [...DEMO].reverse()) {
    const token = demoToken(d.code);
    const sent = new Date(`${d.sentOn}T10:00:00+04:00`);
    const [row] = await db
      .insert(invitation)
      .values({
        token,
        displayName: `Famille ${d.last}`,
        contactFirstName: d.first,
        contactLastName: d.last,
        email: d.email,
        phoneE164: d.phone,
        hostAgreement: d.agreement,
        status: d.status,
        firstSentAt: sent,
        openedAt: d.status === 'sent' ? null : new Date(sent.getTime() + 86_400_000),
        respondedAt:
          d.status === 'submitted' || d.status === 'declined'
            ? new Date(sent.getTime() + 2 * 86_400_000)
            : null,
      })
      .onConflictDoNothing({ target: invitation.token })
      .returning({ id: invitation.id });
    if (row && d.party.length) {
      await db.insert(guest).values(
        d.party.map(([first, last, note], position) => ({
          invitationId: row.id,
          firstName: first,
          lastName: last,
          notes: note || null,
          isPrimary: position === 0,
          position,
        })),
      );
    }
  }

  const plans = await db.select({ id: seatingPlan.id }).from(seatingPlan).limit(1);
  if (plans.length === 0) {
    const [plan] = await db
      .insert(seatingPlan)
      .values({ name: fr.admin.plan.versionDefault(1), isActive: true })
      .returning({ id: seatingPlan.id });
    if (plan) {
      await db.insert(seatingTable).values([
        {
          id: randomUUID(),
          planId: plan.id,
          name: fr.admin.plan.honour,
          shape: 'rect',
          x: 550,
          y: 210,
          seatCount: 8,
          sortOrder: 0,
        },
        {
          id: randomUUID(),
          planId: plan.id,
          name: fr.admin.plan.tableDefault(2),
          shape: 'round',
          x: 300,
          y: 470,
          seatCount: 8,
          sortOrder: 1,
        },
        {
          id: randomUUID(),
          planId: plan.id,
          name: fr.admin.plan.tableDefault(3),
          shape: 'round',
          x: 800,
          y: 470,
          seatCount: 8,
          sortOrder: 2,
        },
      ]);
    }
  }

  const base = getEnv().PUBLIC_URL;
  console.log('\nLiens de démonstration :');
  for (const d of DEMO) console.log(`  ${`Famille ${d.last}`.padEnd(18)} ${base}/i/${demoToken(d.code)}`);
  console.log('');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
