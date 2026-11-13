import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeDb, getDb } from './db/client';
import { hasTestDb, resetTestDb } from './db/test-db';
import { createDbLimiter } from './rate-limit';

describe.skipIf(!hasTestDb)('limites anti-abus (base réelle)', () => {
  beforeAll(() => resetTestDb());
  afterAll(() => closeDb());

  it('compte les tentatives et bloque au-delà de la limite', async () => {
    const limiter = createDbLimiter(getDb());
    const rule = { limit: 2, windowMs: 60_000 };
    expect((await limiter.hit('test:seq', rule)).allowed).toBe(true);
    expect((await limiter.hit('test:seq', rule)).allowed).toBe(true);
    const third = await limiter.hit('test:seq', rule);
    expect(third.allowed).toBe(false);
    expect(third.retryAfterMs).toBeGreaterThan(0);
  });

  it('des tentatives simultanées ne dépassent jamais la limite', async () => {
    const limiter = createDbLimiter(getDb());
    const rule = { limit: 3, windowMs: 60_000 };
    const results = await Promise.all(Array.from({ length: 10 }, () => limiter.hit('test:par', rule)));
    expect(results.filter((d) => d.allowed)).toHaveLength(3);
  });
});
