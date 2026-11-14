import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { closeDb, getDb } from '~/lib/db/client';
import { invitation, type Invitation } from '~/lib/db/schema';
import { hasTestDb, resetTestDb } from '~/lib/db/test-db';
import { RsvpError, submitResponse } from '../rsvp/rsvp.service';
import { createInvitation, updateInvitation } from './invitations.service';

const seat = (first: string) => ({ first, last: 'Hoarau', note: '' });
const empty = (n: number) => Array.from({ length: n }, () => null);

describe.skipIf(!hasTestDb)('nombre de places choisi à l’envoi (base réelle)', () => {
  let inv: Invitation;
  beforeAll(async () => {
    await resetTestDb();
    inv = await createInvitation(getDb(), {
      first: 'Léa',
      last: 'Hoarau',
      email: 'lea.hoarau@example.re',
      phone: undefined,
      displayName: undefined,
      maxSeats: 2,
    });
  });
  afterAll(() => closeDb());

  it('enregistre les places choisies (6 si rien n’est choisi)', async () => {
    expect(inv.maxSeats).toBe(2);
    const other = await createInvitation(getDb(), {
      first: 'Noah',
      last: 'Payet',
      email: 'noah@example.re',
      phone: undefined,
      displayName: undefined,
    });
    expect(other.maxSeats).toBe(6);
  });

  it('refuse une personne de plus que les places prévues', async () => {
    await expect(
      submitResponse(getDb(), inv.token, [seat('Léa'), seat('Paul'), seat('Zoé'), ...empty(3)]),
    ).rejects.toBeInstanceOf(RsvpError);
    const ok = await submitResponse(getDb(), inv.token, [seat('Léa'), seat('Paul'), ...empty(4)]);
    expect(ok.sent).toBe(true);
  });

  it('ne descend pas sous le nombre de personnes ayant répondu, monte librement', async () => {
    const [current] = await getDb().select().from(invitation).where(eq(invitation.id, inv.id));
    await expect(
      updateInvitation(getDb(), inv.id, { maxSeats: 1, expectedUpdatedAt: current!.updatedAt.toISOString() }),
    ).rejects.toThrow('seats_below_guests');
    const up = await updateInvitation(getDb(), inv.id, {
      maxSeats: 4,
      expectedUpdatedAt: current!.updatedAt.toISOString(),
    });
    expect(up.maxSeats).toBe(4);
    const back = await updateInvitation(getDb(), inv.id, {
      maxSeats: 2,
      expectedUpdatedAt: up.updatedAt.toISOString(),
    });
    expect(back.maxSeats).toBe(2);
  });
});
