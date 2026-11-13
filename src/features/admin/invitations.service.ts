/** Espace admin : invitations, indicateurs, import / export CSV, données pour le traiteur. */
import { and, asc, desc, eq, inArray, ne, sql } from 'drizzle-orm';
import { admin as t, status as statusLabels } from '~/content/fr';
import type { Db, DbOrTx } from '~/lib/db/client';
import {
  guest,
  invitation,
  seatingPlan,
  seatingSeat,
  seatingTable,
  sendLog,
  type Guest,
  type Invitation,
  type SendLog,
} from '~/lib/db/schema';
import { formatDateTime, formatShortDate } from '~/lib/dates';
import { checkMailDomain, type DomainStatus } from '~/lib/email-check';
import { formatPhone } from '~/lib/phone';
import { generateToken, personalLink } from '../invitation/token';
import { invitationInput, type InvitationInput } from './admin.schema';
import { headerKey, parseCsv, rowsToRecords, toCsv } from './csv';
import { verifyEmail } from './email-guard';

/** « invitée », « f », « femme » → accord féminin ; tout le reste → « invité ». */
export function parseAgreement(v: string): Invitation['hostAgreement'] {
  return ['invitee', 'f', 'femme', 'elle'].includes(headerKey(v)) ? 'invitee' : 'invite';
}

export interface SendInfo {
  id: string;
  channel: SendLog['channel'];
  purpose: SendLog['purpose'];
  status: SendLog['status'];
  at: string;
  atLabel: string;
  error: string | null;
}

export interface AdminInvitation {
  id: string;
  token: string;
  link: string;
  displayName: string;
  first: string;
  last: string;
  email: string | null;
  phone: string | null;
  phoneLabel: string | null;
  maxSeats: number;
  agreement: Invitation['hostAgreement'];
  status: Invitation['status'];
  updatedAt: string;
  sentLabel: string;
  seats: number;
  notes: Array<{ name: string; note: string }>;
  lastSend: SendInfo | null;
  history: SendInfo[];
}

export interface Kpis {
  sent: number;
  yes: number;
  no: number;
  seats: number;
}

const guestOnly = eq(invitation.kind, 'guest');

function toSendInfo(l: SendLog): SendInfo {
  return {
    id: l.id,
    channel: l.channel,
    purpose: l.purpose,
    status: l.status,
    at: l.createdAt.toISOString(),
    atLabel: formatDateTime(l.createdAt),
    error: l.error,
  };
}

export function toAdminInvitation(
  inv: Invitation,
  guests: Guest[],
  logs: SendLog[],
  publicUrl: string,
): AdminInvitation {
  const confirmed = inv.status === 'submitted';
  return {
    id: inv.id,
    token: inv.token,
    link: personalLink(publicUrl, inv.token),
    displayName: inv.displayName,
    first: inv.contactFirstName,
    last: inv.contactLastName,
    email: inv.email,
    phone: inv.phoneE164,
    phoneLabel: inv.phoneE164 ? formatPhone(inv.phoneE164) : null,
    maxSeats: inv.maxSeats,
    agreement: inv.hostAgreement,
    status: inv.status,
    updatedAt: inv.updatedAt.toISOString(),
    sentLabel: inv.firstSentAt ? t.list.sentOn(formatShortDate(inv.firstSentAt)) : t.list.notSent,
    seats: confirmed ? guests.length : 0,
    notes: confirmed
      ? guests
          .filter((g) => g.notes)
          .map((g) => ({ name: `${g.firstName} ${g.lastName}`.trim(), note: g.notes ?? '' }))
      : [],
    lastSend: logs[0] ? toSendInfo(logs[0]) : null,
    history: logs.map(toSendInfo),
  };
}

export async function listInvitations(db: DbOrTx, publicUrl: string): Promise<AdminInvitation[]> {
  const invs = await db.select().from(invitation).where(guestOnly).orderBy(desc(invitation.createdAt));
  if (!invs.length) return [];
  const ids = invs.map((i) => i.id);
  const [guests, logs] = await Promise.all([
    db.select().from(guest).where(inArray(guest.invitationId, ids)).orderBy(asc(guest.position)),
    db.select().from(sendLog).where(inArray(sendLog.invitationId, ids)).orderBy(desc(sendLog.createdAt)),
  ]);
  const byInv = <T extends { invitationId: string }>(rows: T[]) => {
    const m = new Map<string, T[]>();
    for (const r of rows) m.set(r.invitationId, [...(m.get(r.invitationId) ?? []), r]);
    return m;
  };
  const g = byInv(guests);
  const l = byInv(logs);
  return invs.map((inv) => toAdminInvitation(inv, g.get(inv.id) ?? [], l.get(inv.id) ?? [], publicUrl));
}

export async function getAdminInvitation(
  db: DbOrTx,
  id: string,
  publicUrl: string,
): Promise<AdminInvitation | null> {
  const [inv] = await db
    .select()
    .from(invitation)
    .where(and(eq(invitation.id, id), guestOnly));
  if (!inv) return null;
  const [guests, logs] = await Promise.all([
    db.select().from(guest).where(eq(guest.invitationId, id)).orderBy(asc(guest.position)),
    db.select().from(sendLog).where(eq(sendLog.invitationId, id)).orderBy(desc(sendLog.createdAt)),
  ]);
  return toAdminInvitation(inv, guests, logs, publicUrl);
}

export async function computeKpis(db: DbOrTx): Promise<Kpis> {
  const [row] = await db
    .select({
      sent: sql<number>`count(*) filter (where ${invitation.firstSentAt} is not null)::int`,
      yes: sql<number>`count(*) filter (where ${invitation.status} = 'submitted')::int`,
      no: sql<number>`count(*) filter (where ${invitation.status} = 'declined')::int`,
    })
    .from(invitation)
    .where(guestOnly);
  const [seats] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(guest)
    .innerJoin(invitation, eq(invitation.id, guest.invitationId))
    .where(and(guestOnly, eq(invitation.status, 'submitted')));
  return { sent: row?.sent ?? 0, yes: row?.yes ?? 0, no: row?.no ?? 0, seats: seats?.n ?? 0 };
}

export class DuplicateContactError extends Error {}

/** Existe-t-il déjà une invitation avec ce contact ? (évite les doublons à la création et à l'import) */
async function findByContact(db: DbOrTx, email?: string, phone?: string): Promise<Invitation | null> {
  if (email) {
    const [row] = await db
      .select()
      .from(invitation)
      .where(and(guestOnly, sql`lower(${invitation.email}) = ${email.toLowerCase()}`));
    if (row) return row;
  }
  if (phone) {
    const [row] = await db
      .select()
      .from(invitation)
      .where(and(guestOnly, eq(invitation.phoneE164, phone)));
    if (row) return row;
  }
  return null;
}

export async function createInvitation(db: DbOrTx, input: InvitationInput): Promise<Invitation> {
  if (await findByContact(db, input.email, input.phone)) throw new DuplicateContactError();
  const [row] = await db
    .insert(invitation)
    .values({
      token: generateToken(),
      displayName: input.displayName ?? `Famille ${input.last}`,
      contactFirstName: input.first,
      contactLastName: input.last,
      email: input.email ?? null,
      phoneE164: input.phone ?? null,
      maxSeats: input.maxSeats ?? 6,
      hostAgreement: input.agreement ?? 'invite',
    })
    .returning();
  return row!;
}

export class VersionConflictError extends Error {}

export interface InvitationPatch {
  first?: string;
  last?: string;
  email?: string | null;
  phone?: string | null;
  displayName?: string;
  maxSeats?: number;
  agreement?: Invitation['hostAgreement'];
  expectedUpdatedAt: string;
}

export async function updateInvitation(db: Db, id: string, patch: InvitationPatch): Promise<Invitation> {
  return db.transaction(async (tx) => {
    const [inv] = await tx
      .select()
      .from(invitation)
      .where(and(eq(invitation.id, id), guestOnly))
      .for('update');
    if (!inv) throw new Error('not_found');
    if (inv.updatedAt.getTime() !== new Date(patch.expectedUpdatedAt).getTime())
      throw new VersionConflictError();
    const email = patch.email === undefined ? inv.email : patch.email;
    const phone = patch.phone === undefined ? inv.phoneE164 : patch.phone;
    if (!email && !phone) throw new Error('contact');
    const [row] = await tx
      .update(invitation)
      .set({
        contactFirstName: patch.first ?? inv.contactFirstName,
        contactLastName: patch.last ?? inv.contactLastName,
        email,
        phoneE164: phone,
        displayName: patch.displayName ?? inv.displayName,
        maxSeats: patch.maxSeats ?? inv.maxSeats,
        hostAgreement: patch.agreement ?? inv.hostAgreement,
        updatedAt: new Date(),
      })
      .where(eq(invitation.id, id))
      .returning();
    return row!;
  });
}

export async function deleteInvitations(db: DbOrTx, ids: string[]): Promise<number> {
  const rows = await db
    .delete(invitation)
    .where(and(inArray(invitation.id, ids), guestOnly))
    .returning({ id: invitation.id });
  return rows.length;
}

export interface ImportReport {
  valid: number;
  errors: Array<{ line: number; message: string }>;
  imported: number;
  duplicates: number;
}

/** Import CSV : validation de chaque ligne (dont l'adresse email) ; dryRun = aperçu sans écrire. */
export async function importCsv(
  db: Db,
  csv: string,
  dryRun: boolean,
  checkDomain: (email: string) => Promise<DomainStatus> = checkMailDomain,
): Promise<ImportReport> {
  const records = rowsToRecords(parseCsv(csv));
  const report: ImportReport = { valid: 0, errors: [], imported: 0, duplicates: 0 };
  const valid: InvitationInput[] = [];
  // une seule requête DNS par domaine
  const domains = new Map<string, Promise<DomainStatus>>();
  const cachedCheck = (email: string) => {
    const d = email.slice(email.lastIndexOf('@') + 1);
    if (!domains.has(d)) domains.set(d, checkDomain(email));
    return domains.get(d)!;
  };
  for (const r of records) {
    const parsed = invitationInput.safeParse({
      ...r.data,
      agreement: r.data.agreement ? parseAgreement(r.data.agreement) : undefined,
    });
    if (!parsed.success) {
      const m = parsed.error.issues.map((i) => i.message);
      report.errors.push({
        line: r.line,
        message: m.includes('phone')
          ? t.list.phoneInvalid
          : m.includes('email')
            ? t.list.emailInvalid
            : t.list.missing,
      });
    } else if (parsed.data.email) {
      const v = await verifyEmail(parsed.data.email, { checkDomain: cachedCheck });
      if (v.ok) valid.push(parsed.data);
      else {
        report.errors.push({
          line: r.line,
          message: v.code === 'email_typo' ? t.list.csvEmailTypo(v.suggestion) : t.list.emailDomain(v.domain),
        });
      }
    } else valid.push(parsed.data);
  }
  report.valid = valid.length;
  if (dryRun) return report;
  await db.transaction(async (tx) => {
    for (const v of valid) {
      try {
        await createInvitation(tx, v);
        report.imported++;
      } catch (err) {
        if (err instanceof DuplicateContactError) report.duplicates++;
        else throw err;
      }
    }
  });
  return report;
}

export async function exportInvitationsCsv(db: DbOrTx, publicUrl: string): Promise<string> {
  const list = await listInvitations(db, publicUrl);
  const ids = list.map((i) => i.id);
  const guests = ids.length
    ? await db.select().from(guest).where(inArray(guest.invitationId, ids)).orderBy(asc(guest.position))
    : [];
  const header = [
    'nom_affiche',
    'prenom',
    'nom',
    'email',
    'telephone',
    'statut',
    'places',
    'personnes',
    'allergies',
    'lien',
    'premier_envoi',
  ];
  const rows = list.map((i) => {
    const party = guests.filter((g) => g.invitationId === i.id);
    return [
      i.displayName,
      i.first,
      i.last,
      i.email ?? '',
      i.phone ?? '',
      statusLabels[i.status],
      i.seats || '',
      party.map((g) => `${g.firstName} ${g.lastName}`.trim()).join(', '),
      party
        .filter((g) => g.notes)
        .map((g) => `${g.firstName} : ${g.notes}`)
        .join(' | '),
      i.link,
      i.sentLabel,
    ];
  });
  return toCsv(header, rows);
}

export interface CatererRow {
  family: string;
  first: string;
  last: string;
  note: string;
  table: string;
}

/** Personnes confirmées, avec la table du plan actif s'il existe. */
export async function catererRows(db: DbOrTx): Promise<CatererRow[]> {
  const rows = await db
    .select({ g: guest, family: invitation.displayName })
    .from(guest)
    .innerJoin(invitation, eq(invitation.id, guest.invitationId))
    .where(and(eq(invitation.status, 'submitted'), ne(invitation.kind, 'couple')))
    .orderBy(asc(invitation.displayName), asc(guest.position));
  const seats = await db
    .select({ guestId: seatingSeat.guestId, table: seatingTable.name })
    .from(seatingSeat)
    .innerJoin(seatingTable, eq(seatingTable.id, seatingSeat.tableId))
    .innerJoin(seatingPlan, eq(seatingPlan.id, seatingSeat.planId))
    .where(eq(seatingPlan.isActive, true));
  const tableOf = new Map(seats.map((s) => [s.guestId, s.table]));
  return rows.map(({ g, family }) => ({
    family,
    first: g.firstName,
    last: g.lastName,
    note: g.notes ?? '',
    table: tableOf.get(g.id) ?? '',
  }));
}

/** Regroupe les allergies identiques (casse et espaces ignorés) pour le traiteur. */
export function groupNotes(rows: CatererRow[]): Array<{ note: string; people: string[] }> {
  const groups = new Map<string, { note: string; people: string[] }>();
  for (const r of rows) {
    if (!r.note.trim()) continue;
    const key = r.note.trim().toLowerCase().replace(/\s+/g, ' ');
    const gr = groups.get(key) ?? { note: r.note.trim(), people: [] };
    gr.people.push(`${r.first} ${r.last}`.trim() + ` (${r.family})`);
    groups.set(key, gr);
  }
  return [...groups.values()].sort(
    (a, b) => b.people.length - a.people.length || a.note.localeCompare(b.note, 'fr'),
  );
}

export function catererCsv(rows: CatererRow[]): string {
  return toCsv(
    [t.caterer.family, 'Prénom', 'Nom', t.caterer.note, t.caterer.table],
    rows.map((r) => [r.family, r.first, r.last, r.note, r.table]),
  );
}
