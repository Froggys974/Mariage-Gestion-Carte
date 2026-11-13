/**
 * Réponses des invités : ouverture, brouillon, envoi (remplacement sans doublon), déclin.
 * Chaque écriture se fait dans une transaction, invitation verrouillée (FOR UPDATE).
 * Contrôle de version : `updated_at` ne change qu'à l'envoi / au déclin (et aux modifications admin).
 */
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import type { Db, Tx } from '~/lib/db/client';
import { guest, invitation, type Draft, type Invitation } from '~/lib/db/schema';
import { getSiteSettings, isClosed } from '../card/card.service';
import { SEAT_COUNT, type BootSeat } from '../invitation/boot';
import { guestsToSeats, normalizeDraft, sameSeats } from '../invitation/invitation.service';
import { isTokenShape } from '../invitation/token';
import { planGuestReplacement } from './replace';
import type { SeatsInput } from './rsvp.schema';

export type RsvpErrorCode = 'not_found' | 'closed' | 'conflict' | 'invalid';

export interface RsvpState {
  seats: Array<BootSeat | null>;
  sent: boolean;
  declined: boolean;
  changed: boolean;
  updatedAt: string;
}

export class RsvpError extends Error {
  constructor(
    readonly code: RsvpErrorCode,
    readonly state?: RsvpState,
  ) {
    super(code);
  }
}

/** Décalage temporaire des positions pendant le remplacement (contrainte unique invitation+position). */
const TEMP_POSITION_OFFSET = 100;
const EARLY_STATUSES = ['not_sent', 'sent', 'opened'] as const;

async function lock(tx: Tx, token: string): Promise<Invitation> {
  if (!isTokenShape(token)) throw new RsvpError('not_found');
  const [inv] = await tx
    .select()
    .from(invitation)
    .where(and(eq(invitation.token, token), eq(invitation.kind, 'guest')))
    .for('update');
  if (!inv) throw new RsvpError('not_found');
  return inv;
}

async function assertOpen(tx: Tx): Promise<void> {
  if (isClosed(await getSiteSettings(tx))) throw new RsvpError('closed');
}

function assertSeatsFit(inv: Invitation, seats: SeatsInput): void {
  seats.forEach((s, i) => {
    if (s && i >= inv.maxSeats) throw new RsvpError('invalid');
  });
}

async function stateOf(tx: Tx, inv: Invitation): Promise<RsvpState> {
  const rows = await tx
    .select()
    .from(guest)
    .where(eq(guest.invitationId, inv.id))
    .orderBy(asc(guest.position));
  const submitted = guestsToSeats(rows);
  const seats = inv.draft
    ? normalizeDraft(inv.draft)
    : rows.length
      ? submitted
      : [
          { first: inv.contactFirstName, last: inv.contactLastName, note: '' },
          ...Array.from({ length: SEAT_COUNT - 1 }, () => null),
        ];
  return {
    seats,
    sent: inv.status === 'submitted',
    declined: inv.status === 'declined',
    changed: inv.status === 'submitted' && Boolean(inv.draft) && !sameSeats(seats, submitted),
    updatedAt: inv.updatedAt.toISOString(),
  };
}

function checkVersion(inv: Invitation, expected: string | null | undefined): boolean {
  return !expected || inv.updatedAt.getTime() === new Date(expected).getTime();
}

/** Première visite : statut « opened » (sans toucher au numéro de version). */
export async function markOpened(db: Db, token: string): Promise<void> {
  if (!isTokenShape(token)) return;
  await db
    .update(invitation)
    .set({ status: 'opened', openedAt: sql`coalesce(${invitation.openedAt}, now())` })
    .where(
      and(
        eq(invitation.token, token),
        eq(invitation.kind, 'guest'),
        inArray(invitation.status, [...EARLY_STATUSES]),
      ),
    );
}

/** Brouillon (enregistré 1 s après la dernière modification). Statut « started » dès la première chaise. */
export async function saveDraft(
  db: Db,
  token: string,
  seats: SeatsInput,
): Promise<{ draftUpdatedAt: string }> {
  return db.transaction(async (tx) => {
    const inv = await lock(tx, token);
    await assertOpen(tx);
    assertSeatsFit(inv, seats);
    const now = new Date();
    const draft: Draft = seats.map((s) =>
      s ? { ...(s.id ? { id: s.id } : {}), first: s.first, last: s.last, note: s.note } : null,
    );
    const early = (EARLY_STATUSES as readonly string[]).includes(inv.status);
    await tx
      .update(invitation)
      .set({
        draft,
        draftUpdatedAt: now,
        ...(early ? { status: 'started' as const, openedAt: inv.openedAt ?? now } : {}),
      })
      .where(eq(invitation.id, inv.id));
    return { draftUpdatedAt: now.toISOString() };
  });
}

/** Envoi : la liste des invités est REMPLACÉE entièrement (jamais un ajout à la suite). */
export async function submitResponse(
  db: Db,
  token: string,
  seats: SeatsInput,
  expectedUpdatedAt?: string | null,
): Promise<RsvpState> {
  return db.transaction(async (tx) => {
    const inv = await lock(tx, token);
    await assertOpen(tx);
    if (!checkVersion(inv, expectedUpdatedAt)) throw new RsvpError('conflict', await stateOf(tx, inv));
    assertSeatsFit(inv, seats);

    const existing = await tx
      .select({ id: guest.id, position: guest.position })
      .from(guest)
      .where(eq(guest.invitationId, inv.id));
    const plan = planGuestReplacement(existing, seats);
    const now = new Date();
    if (plan.deletes.length) await tx.delete(guest).where(inArray(guest.id, plan.deletes));
    if (plan.updates.length) {
      // libère d'abord les positions pour permettre les échanges sans violer la contrainte unique
      await tx
        .update(guest)
        .set({ position: sql`${guest.position} + ${TEMP_POSITION_OFFSET}` })
        .where(
          inArray(
            guest.id,
            plan.updates.map((u) => u.id),
          ),
        );
      for (const u of plan.updates) {
        await tx
          .update(guest)
          .set({
            position: u.position,
            firstName: u.firstName,
            lastName: u.lastName,
            notes: u.notes,
            isPrimary: u.isPrimary,
            updatedAt: now,
          })
          .where(eq(guest.id, u.id));
      }
    }
    if (plan.inserts.length) {
      await tx.insert(guest).values(plan.inserts.map((r) => ({ ...r, invitationId: inv.id })));
    }
    const [updated] = await tx
      .update(invitation)
      .set({
        status: 'submitted',
        respondedAt: now,
        openedAt: inv.openedAt ?? now,
        draft: null,
        draftUpdatedAt: null,
        updatedAt: now,
      })
      .where(eq(invitation.id, inv.id))
      .returning();
    return stateOf(tx, updated!);
  });
}

/** « Nous ne pourrons pas venir » : la réponse est conservée, le statut passe à « declined ». */
export async function declineResponse(
  db: Db,
  token: string,
  expectedUpdatedAt?: string | null,
): Promise<RsvpState> {
  return db.transaction(async (tx) => {
    const inv = await lock(tx, token);
    await assertOpen(tx);
    if (!checkVersion(inv, expectedUpdatedAt)) throw new RsvpError('conflict', await stateOf(tx, inv));
    const now = new Date();
    const [updated] = await tx
      .update(invitation)
      .set({ status: 'declined', respondedAt: now, openedAt: inv.openedAt ?? now, updatedAt: now })
      .where(eq(invitation.id, inv.id))
      .returning();
    return stateOf(tx, updated!);
  });
}

/** Réponse HTTP pour une erreur métier. */
export function rsvpErrorStatus(code: RsvpErrorCode): number {
  return { not_found: 404, closed: 403, conflict: 409, invalid: 400 }[code];
}
