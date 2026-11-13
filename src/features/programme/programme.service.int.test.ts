import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeDb, getDb } from '~/lib/db/client';
import { hasTestDb, resetTestDb } from '~/lib/db/test-db';
import { buildGuestBoot } from '../invitation/invitation.service';
import { loadProgramme, updateProgramme } from './programme.service';

describe.skipIf(!hasTestDb)('programme (base réelle)', () => {
  beforeAll(() => resetTestDb());
  afterAll(() => closeDb());

  it('affiche le programme créé à l’installation, puis celui des mariés sur le site invité', async () => {
    const db = getDb();
    expect((await loadProgramme(db)).map((i) => i.title)).toEqual(['Cérémonie', 'Réception']);
    const items = [
      { time: '15h00', title: 'Cérémonie', place: 'Église Saint-Pierre', note: '' },
      { time: '19h30', title: 'Dîner', place: '', note: 'Navette depuis l’église' },
    ];
    expect(await updateProgramme(db, items)).toEqual(items);
    expect(await loadProgramme(db)).toEqual(items);
    expect((await buildGuestBoot(db, null))?.programme).toEqual(items);
  });
});
