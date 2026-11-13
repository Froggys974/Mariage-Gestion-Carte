import { describe, expect, it } from 'vitest';
import { enqueue, pickInitial, retryDelay, type QueueItem } from './draft-sync';

const s = (first: string) => [{ first, last: 'Payet', note: '' }, null, null, null, null, null];

describe('file d’attente hors ligne', () => {
  it('ne garde que le dernier brouillon', () => {
    let q: QueueItem[] = [];
    q = enqueue(q, { kind: 'draft', seats: s('A') });
    q = enqueue(q, { kind: 'draft', seats: s('B') });
    expect(q).toHaveLength(1);
    expect(q[0]).toMatchObject({ kind: 'draft', seats: s('B') });
  });
  it('un envoi remplace les brouillons en attente', () => {
    let q: QueueItem[] = [{ kind: 'draft', seats: s('A') }];
    q = enqueue(q, { kind: 'submit', seats: s('A'), expectedUpdatedAt: null });
    expect(q.map((i) => i.kind)).toEqual(['submit']);
  });
  it('une modification après un envoi en attente s’ajoute derrière', () => {
    let q: QueueItem[] = [{ kind: 'submit', seats: s('A'), expectedUpdatedAt: null }];
    q = enqueue(q, { kind: 'draft', seats: s('B') });
    expect(q.map((i) => i.kind)).toEqual(['submit', 'draft']);
  });
  it('espace les réessais de plus en plus', () => {
    expect(retryDelay(0)).toBeLessThan(retryDelay(1));
    expect(retryDelay(99)).toBe(60_000);
  });
});

describe('reprise du brouillon', () => {
  it('reprend le brouillon local s’il est plus récent que celui du serveur', () => {
    const r = pickInitial(s('Serveur'), '2026-10-01T10:00:00.000Z', {
      seats: s('Local'),
      at: Date.parse('2026-10-02'),
    });
    expect(r.fromLocal).toBe(true);
    expect(r.seats[0]?.first).toBe('Local');
  });
  it('garde la version du serveur si elle est plus récente (autre appareil)', () => {
    const r = pickInitial(s('Serveur'), '2026-10-03T10:00:00.000Z', {
      seats: s('Local'),
      at: Date.parse('2026-10-02'),
    });
    expect(r.fromLocal).toBe(false);
    expect(r.seats[0]?.first).toBe('Serveur');
  });
});
