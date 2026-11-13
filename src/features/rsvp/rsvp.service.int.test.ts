import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { closeDb, getDb } from '~/lib/db/client';
import { guest, invitation, siteSettings } from '~/lib/db/schema';
import { hasTestDb, resetTestDb } from '~/lib/db/test-db';
import { generateToken } from '../invitation/token';
import { declineResponse, markOpened, RsvpError, saveDraft, submitResponse } from './rsvp.service';

const seat = (first: string, id?: string, note = '') => ({ id, first, last: 'Payet', note });
const empty = (n: number) => Array.from({ length: n }, () => null);

describe.skipIf(!hasTestDb)('rsvp.service (base réelle)', () => {
  let token = '';
  beforeAll(async () => {
    await resetTestDb();
    token = generateToken();
    await getDb().insert(invitation).values({
      token,
      displayName: 'Famille Payet',
      contactFirstName: 'Marie-Ange',
      contactLastName: 'Payet',
      email: 'ma@example.re',
      status: 'sent',
    });
  });
  afterAll(() => closeDb());

  const guestsOf = async () => {
    const [inv] = await getDb().select().from(invitation).where(eq(invitation.token, token));
    return getDb().select().from(guest).where(eq(guest.invitationId, inv!.id));
  };

  it('ouverture puis brouillon : opened puis started', async () => {
    await markOpened(getDb(), token);
    let [inv] = await getDb().select().from(invitation).where(eq(invitation.token, token));
    expect(inv?.status).toBe('opened');
    await saveDraft(getDb(), token, [seat('Marie-Ange'), seat('Léa'), ...empty(4)]);
    [inv] = await getDb().select().from(invitation).where(eq(invitation.token, token));
    expect(inv?.status).toBe('started');
    expect(inv?.draft?.[1]?.first).toBe('Léa');
  });

  it('envoyer, recharger, modifier, renvoyer : jamais de doublon', async () => {
    const first = await submitResponse(getDb(), token, [
      seat('Marie-Ange'),
      seat('Léa', undefined, 'Fruits de mer'),
      seat('Noah'),
      ...empty(3),
    ]);
    expect(first.sent).toBe(true);
    expect(await guestsOf()).toHaveLength(3);
    const ids = first.seats.map((s) => s?.id);
    // modification : Noah retiré, Jean-Luc ajouté, Léa garde son id
    const second = await submitResponse(
      getDb(),
      token,
      [seat('Marie-Ange', ids[0]), seat('Léa', ids[1], 'Fruits de mer'), null, seat('Jean-Luc'), null, null],
      first.updatedAt,
    );
    const rows = await guestsOf();
    expect(rows).toHaveLength(3);
    expect(rows.find((r) => r.firstName === 'Léa')?.id).toBe(ids[1]);
    expect(rows.find((r) => r.firstName === 'Noah')).toBeUndefined();
    // renvoi identique (double clic) : toujours 3 lignes
    await submitResponse(getDb(), token, second.seats as never, second.updatedAt);
    expect(await guestsOf()).toHaveLength(3);
  });

  it('refuse un envoi basé sur une version périmée (autre appareil)', async () => {
    await expect(
      submitResponse(getDb(), token, [seat('Marie-Ange'), ...empty(5)], '2000-01-01T00:00:00.000Z'),
    ).rejects.toMatchObject({ code: 'conflict' });
  });

  it('déclin : statut declined, réponse conservée', async () => {
    const st = await declineResponse(getDb(), token);
    expect(st.declined).toBe(true);
    expect(await guestsOf()).toHaveLength(3);
  });

  it('après la date limite : lecture seule', async () => {
    await getDb()
      .update(siteSettings)
      .set({ rsvpDeadline: new Date('2020-01-01') });
    await expect(saveDraft(getDb(), token, [seat('X'), ...empty(5)])).rejects.toBeInstanceOf(RsvpError);
    await getDb()
      .update(siteSettings)
      .set({ rsvpDeadline: new Date('2099-01-01') });
  });
});
