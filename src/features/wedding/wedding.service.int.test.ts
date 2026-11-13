import { sql } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, getDb } from '~/lib/db/client';
import { guest, invitation } from '~/lib/db/schema';
import { hasTestDb, resetTestDb } from '~/lib/db/test-db';
import { eq } from 'drizzle-orm';
import { getCardSettings, getSiteSettings } from '../card/card.service';
import { buildGuestBoot } from '../invitation/invitation.service';
import { loadProgramme } from '../programme/programme.service';
import { DEMO_WEDDING } from './demo';
import { AlreadyConfiguredError, getWedding, setupWedding, updateWedding } from './wedding.service';

describe.skipIf(!hasTestDb)('infos du mariage (base réelle)', () => {
  beforeEach(() => resetTestDb());
  afterAll(() => closeDb());

  it('base neuve : rien n’est configuré, le site invité attend l’assistant', async () => {
    const db = getDb();
    await db.execute(sql`TRUNCATE wedding, invitation CASCADE`);
    expect(await getWedding(db)).toBeNull();
    expect(await buildGuestBoot(db, null)).toBeNull();
  });

  it('l’installation prépare carte, programme, dates et « Les mariés »', async () => {
    const db = getDb(); // resetTestDb a déjà lancé setupWedding(DEMO_WEDDING)
    const card = await getCardSettings(db);
    expect(card.names).toBe('Camille & Alex');
    expect(card.dateLabel).toBe('12 · 06 · 2027');
    expect(card.place).toBe('Église Saint-Pierre\nSaint-Pierre, La Réunion');
    expect([card.ceremonyTime, card.receptionTime]).toEqual(['15h00', '18h00']);
    expect((await loadProgramme(db)).map((i) => `${i.time} ${i.title}`)).toEqual([
      '15h00 Cérémonie',
      '18h00 Réception',
    ]);
    const settings = await getSiteSettings(db);
    expect(settings.rsvpDeadline.toISOString()).toBe('2027-05-25T19:59:59.000Z'); // 23:59:59 à La Réunion
    expect(settings.purgeAt.toISOString()).toBe('2027-09-11T20:00:00.000Z'); // 12/09/2027 à 0 h
    const boot = await buildGuestBoot(db, null);
    expect(boot?.wedding.couple).toBe('Camille & Alex');
    const [couple] = await db.select().from(invitation).where(eq(invitation.kind, 'couple'));
    const names = await db
      .select({ f: guest.firstName })
      .from(guest)
      .where(eq(guest.invitationId, couple!.id));
    expect(names.map((n) => n.f).sort()).toEqual(['Alex', 'Camille']);
  });

  it('une seule installation ; les modifications mettent à jour « Les mariés »', async () => {
    const db = getDb();
    await expect(setupWedding(db, DEMO_WEDDING)).rejects.toBeInstanceOf(AlreadyConfiguredError);
    const { rsvpDeadline: _d, ...info } = DEMO_WEDDING;
    const updated = await updateWedding(db, { ...info, partner2First: 'Alexis', venueCity: 'Saint-Paul' });
    expect(updated.partner2First).toBe('Alexis');
    expect((await buildGuestBoot(db, null))?.wedding.venueCity).toBe('Saint-Paul');
    const [couple] = await db.select().from(invitation).where(eq(invitation.kind, 'couple'));
    const names = await db
      .select({ f: guest.firstName })
      .from(guest)
      .where(eq(guest.invitationId, couple!.id));
    expect(names.map((n) => n.f).sort()).toEqual(['Alexis', 'Camille']);
  });
});
