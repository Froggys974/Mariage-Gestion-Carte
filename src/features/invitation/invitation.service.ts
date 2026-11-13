/** Invitations côté site invité : recherche par token, données de la page. */
import { asc, eq } from 'drizzle-orm';
import { fr } from '~/content/fr';
import type { DbOrTx } from '~/lib/db/client';
import { guest, invitation, type Draft, type Guest, type Invitation } from '~/lib/db/schema';
import { formatDayMonth, formatLongDate } from '~/lib/dates';
import { getCardSettings, getSiteSettings, isClosed, toBootCard } from '../card/card.service';
import { programmeOf } from '../programme/programme.service';
import { getWeddingLabels } from '../wedding/wedding.service';
import { SEAT_COUNT, type BootSeat, type GuestBoot } from './boot';
import { isTokenShape } from './token';

export async function findInvitationByToken(db: DbOrTx, token: string): Promise<Invitation | null> {
  if (!isTokenShape(token)) return null;
  const [row] = await db.select().from(invitation).where(eq(invitation.token, token));
  return row && row.kind === 'guest' ? row : null;
}

export async function listGuests(db: DbOrTx, invitationId: string): Promise<Guest[]> {
  return db.select().from(guest).where(eq(guest.invitationId, invitationId)).orderBy(asc(guest.position));
}

/** Réponse enregistrée → chaises (index = position). */
export function guestsToSeats(guests: Guest[]): Array<BootSeat | null> {
  const seats: Array<BootSeat | null> = Array.from({ length: SEAT_COUNT }, () => null);
  for (const g of guests) {
    if (g.position < SEAT_COUNT) {
      seats[g.position] = { id: g.id, first: g.firstName, last: g.lastName, note: g.notes ?? '' };
    }
  }
  return seats;
}

export function normalizeDraft(draft: Draft): Array<BootSeat | null> {
  return Array.from({ length: SEAT_COUNT }, (_, i) => {
    const s = draft[i];
    return s ? { ...(s.id ? { id: s.id } : {}), first: s.first, last: s.last, note: s.note } : null;
  });
}

export function sameSeats(a: ReadonlyArray<BootSeat | null>, b: ReadonlyArray<BootSeat | null>): boolean {
  const key = (s: BootSeat | null | undefined) =>
    s ? `${s.first.trim()}|${s.last.trim()}|${s.note.trim()}` : '';
  return a.length === b.length && a.every((s, i) => key(s) === key(b[i]));
}

/** Données du site invité ; null tant que le mariage n'est pas configuré (assistant d'installation). */
export async function buildGuestBoot(db: DbOrTx, inv: Invitation | null): Promise<GuestBoot | null> {
  const w = await getWeddingLabels(db);
  if (!w) return null;
  const [card, settings] = await Promise.all([getCardSettings(db), getSiteSettings(db)]);
  const common = {
    deadlineLabel: formatDayMonth(settings.rsvpDeadline),
    closed: isClosed(settings),
    purgeLabel: formatLongDate(settings.purgeAt),
    publicRsvp: settings.publicRsvpEnabled,
    card: toBootCard(card),
    programme: programmeOf(card, w),
    wedding: w,
  };
  if (!inv) {
    return {
      token: null,
      email: null,
      family: fr.table.familyFallback,
      hostAgreement: 'invite',
      maxSeats: SEAT_COUNT,
      seats: Array.from({ length: SEAT_COUNT }, () => null),
      status: null,
      sent: false,
      declined: false,
      changed: false,
      updatedAt: null,
      draftUpdatedAt: null,
      ...common,
    };
  }
  const guests = await listGuests(db, inv.id);
  const submitted = guestsToSeats(guests);
  let seats: Array<BootSeat | null> =
    guests.length > 0
      ? submitted
      : [
          { first: inv.contactFirstName, last: inv.contactLastName, note: '' },
          ...Array.from({ length: SEAT_COUNT - 1 }, () => null),
        ];
  let changed = false;
  if (inv.draft) {
    const draft = normalizeDraft(inv.draft);
    if (inv.status === 'submitted' && !sameSeats(draft, submitted)) changed = true;
    seats = draft;
  }
  return {
    token: inv.token,
    email: inv.email,
    family: inv.displayName,
    hostAgreement: inv.hostAgreement,
    maxSeats: inv.maxSeats,
    seats,
    status: inv.status,
    sent: inv.status === 'submitted',
    declined: inv.status === 'declined',
    changed,
    updatedAt: inv.updatedAt.toISOString(),
    draftUpdatedAt: inv.draftUpdatedAt?.toISOString() ?? null,
    ...common,
  };
}
