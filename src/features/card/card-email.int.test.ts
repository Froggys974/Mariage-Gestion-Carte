import { eq } from 'drizzle-orm';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeDb, getDb } from '~/lib/db/client';
import { invitation, messageJob, sendLog } from '~/lib/db/schema';
import { hasTestDb, resetTestDb } from '~/lib/db/test-db';
import { FakeEmailProvider, FakeWhatsAppProvider } from '~/lib/messaging/providers';
import { getStorage } from '~/lib/storage/storage';
import { processNext } from '../messaging/worker-core';
import { CARD_EMAIL, CardEmailError, requestCardEmail } from './card-email.service';
import { PNG } from './client/card-png';

const okDomain = async () => 'ok' as const;
const cardPng = () =>
  sharp({ create: { width: PNG.W, height: PNG.H, channels: 3, background: '#fbf7ee' } })
    .png()
    .toBuffer();

describe.skipIf(!hasTestDb)('carte par email (base réelle)', () => {
  let token = '';
  beforeAll(async () => {
    await resetTestDb();
    const [row] = await getDb()
      .insert(invitation)
      .values({
        token: 'CarteEmailToken0123456',
        displayName: 'Famille Test',
        contactFirstName: 'Lucie',
        contactLastName: 'Test',
        phoneE164: '+262692000001', // invitée sans email : la carte part quand même à l'adresse saisie
      })
      .returning();
    token = row!.token;
  });
  afterAll(() => closeDb());

  const ask = async (email: string, png?: Buffer) =>
    requestCardEmail(getDb(), getStorage(), { token, email, png: png ?? (await cardPng()) }, okDomain);
  const code = (p: Promise<unknown>) =>
    p.then(
      () => 'ok',
      (e: unknown) => (e instanceof CardEmailError ? e.code : 'autre'),
    );

  it('refuse un lien inconnu, une adresse invalide, une image qui n’est pas la carte', async () => {
    const db = getDb();
    expect(
      await code(
        requestCardEmail(db, getStorage(), {
          token: 'Inconnu0123456789abcd',
          email: 'a@b.fr',
          png: await cardPng(),
        }),
      ),
    ).toBe('not_found');
    expect(await code(ask('pas-un-email'))).toBe('email');
    const small = await sharp({ create: { width: 200, height: 200, channels: 3, background: '#fff' } })
      .png()
      .toBuffer();
    expect(await code(ask('a@b.fr', small))).toBe('image');
    expect(await code(ask('a@b.fr', Buffer.from('pas une image')))).toBe('image');
    expect(
      await code(
        requestCardEmail(
          db,
          getStorage(),
          { token, email: 'a@domaine-absent.fr', png: await cardPng() },
          async () => 'no_mail',
        ),
      ),
    ).toBe('email_domain');
  });

  it('envoie la carte (image dans l’email + pièce jointe), puis efface l’image', async () => {
    const db = getDb();
    const r = await ask(' Lucie.Test@Exemple.fr ');
    expect(r).toEqual({ to: 'lucie.test@exemple.fr', remaining: CARD_EMAIL.MAX_PER_INVITATION - 1 });
    const [job] = await db.select().from(messageJob);
    const cardKey = job!.payload.cardKey!;
    expect(await getStorage().get(cardKey)).not.toBeNull();

    const email = new FakeEmailProvider();
    expect(await processNext(db, { email, whatsapp: new FakeWhatsAppProvider() })).toBe(true);
    const sent = email.outbox[0]!;
    expect(sent.to).toBe('lucie.test@exemple.fr');
    expect(sent.subject).toBe('Votre faire‑part · Camille & Alex');
    expect(sent.html).toContain('src="cid:faire-part"');
    expect(sent.attachments?.map((a) => [a.filename, a.cid ?? null])).toEqual([
      ['Faire-part-Camille-Alex.png', 'faire-part'],
      ['Faire-part-Camille-Alex.png', null],
    ]);
    expect(await getStorage().get(cardKey)).toBeNull();
    const [log] = await db.select().from(sendLog).where(eq(sendLog.purpose, 'carte'));
    expect(log?.status).toBe('sent');
  });

  it('3 envois au plus par invitation', async () => {
    expect(await code(ask('a@b.fr'))).toBe('ok');
    expect(await code(ask('c@d.fr'))).toBe('ok');
    expect(await code(ask('e@f.fr'))).toBe('too_many');
  });
});
