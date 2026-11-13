import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeDb, getDb } from '~/lib/db/client';
import { hasTestDb, resetTestDb } from '~/lib/db/test-db';
import { buildGuestBoot } from '../invitation/invitation.service';
import { frameBody, loadEditorData, setCardImage, setPhotoFrame } from './card.admin';

describe.skipIf(!hasTestDb)('cadrage de la photo (base réelle)', () => {
  beforeAll(() => resetTestDb());
  afterAll(() => closeDb());

  it('enregistre la forme et le cadrage, visibles dans l’admin et sur le site', async () => {
    const db = getDb();
    expect((await loadEditorData(db)).card.frame).toEqual({ shape: 'rect', x: 50, y: 50, zoom: 1 });
    await setPhotoFrame(db, { shape: 'round', x: 20, y: 70, zoom: 1.8 });
    expect((await loadEditorData(db)).card.frame).toEqual({ shape: 'round', x: 20, y: 70, zoom: 1.8 });
    expect((await buildGuestBoot(db, null))?.card.frame.shape).toBe('round');
  });

  it('une nouvelle photo est recentrée, mais garde la forme choisie', async () => {
    const db = getDb();
    await setPhotoFrame(db, { shape: 'arch', x: 10, y: 90, zoom: 2.5 });
    await setCardImage(db, 'photoKey', 'card/photo-abc_1600x1067');
    expect((await loadEditorData(db)).card.frame).toEqual({ shape: 'arch', x: 50, y: 50, zoom: 1 });
  });

  it('refuse une forme inconnue ou un zoom hors limites', () => {
    expect(frameBody.safeParse({ shape: 'coeur', x: 50, y: 50, zoom: 1 }).success).toBe(false);
    expect(frameBody.safeParse({ shape: 'oval', x: 50, y: 50, zoom: 4 }).success).toBe(false);
    expect(frameBody.safeParse({ shape: 'oval', x: 50, y: 50, zoom: 0.05 }).success).toBe(false);
    expect(frameBody.safeParse({ shape: 'rect', x: 50, y: 50, zoom: 0.5 }).success).toBe(true);
    expect(frameBody.safeParse({ shape: 'oval', x: 101, y: 50, zoom: 1 }).success).toBe(false);
    expect(frameBody.safeParse({ shape: 'oval', x: 0, y: 100, zoom: 3 }).success).toBe(true);
  });
});
