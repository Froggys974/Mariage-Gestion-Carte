import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeDb, getDb } from '~/lib/db/client';
import { hasTestDb, resetTestDb } from '~/lib/db/test-db';
import { createInvitation, DuplicateNameError, importCsv, listInvitations } from './invitations.service';

const noDns = () => Promise.resolve('ok' as const);
const base = { phone: undefined, displayName: undefined };

describe.skipIf(!hasTestDb)('même prénom + nom (base réelle)', () => {
  beforeAll(async () => {
    await resetTestDb();
    await createInvitation(getDb(), {
      ...base,
      first: 'Marie-Ange',
      last: 'Payet',
      email: 'ma.payet@example.re',
    });
  });
  afterAll(() => closeDb());

  it('« Nouvel envoi » : refuse un homonyme sans confirmation, en disant qui existe déjà', async () => {
    const err = await createInvitation(getDb(), {
      ...base,
      first: 'marie ange',
      last: 'PAYET',
      email: 'autre.payet@example.re',
    }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(DuplicateNameError);
    expect((err as DuplicateNameError).existing).toEqual({
      name: 'Marie-Ange Payet',
      family: 'Famille Payet',
      firstSentAt: null,
    });
  });

  it('« Créer quand même » : un vrai homonyme est créé', async () => {
    const inv = await createInvitation(getDb(), {
      ...base,
      first: 'Marie-Ange',
      last: 'Payet',
      email: 'homonyme.payet@example.re',
      confirmName: true,
    });
    expect(inv.contactFirstName).toBe('Marie-Ange');
  });

  it('import CSV : les homonymes (site ou plus haut dans le fichier) sont ignorés et listés dès l’aperçu', async () => {
    const csv = [
      'prenom;nom;email',
      'Marie-Ange;Payet;encore.payet@example.re',
      'Noah;Hoarau;noah@example.re',
      'Noah;Hoarau;noah2@example.re',
    ].join('\n');
    const preview = await importCsv(getDb(), csv, true, noDns);
    expect(preview.valid).toBe(1);
    expect(preview.sameName).toEqual([
      { line: 2, name: 'Marie-Ange Payet' },
      { line: 4, name: 'Noah Hoarau' },
    ]);
    const done = await importCsv(getDb(), csv, false, noDns);
    expect(done.imported).toBe(1);
    expect(done.duplicates).toBe(2);
    const list = await listInvitations(getDb(), 'http://localhost');
    expect(list.filter((i) => i.last === 'Hoarau')).toHaveLength(1);
  });
});
