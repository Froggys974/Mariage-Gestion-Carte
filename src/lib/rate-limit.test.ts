import { describe, expect, it } from 'vitest';
import { createMemoryLimiter, decide, hashKey, LIMITS } from './rate-limit';

describe('rate limit (fenêtre glissante)', () => {
  it('connexion admin : 5 essais par 15 minutes, le 6e est refusé', async () => {
    let t = 0;
    const rl = createMemoryLimiter(() => t);
    for (let i = 0; i < 5; i++) {
      expect((await rl.hit('ip:1', LIMITS.ADMIN_LOGIN)).allowed).toBe(true);
      t += 1000;
    }
    const sixth = await rl.hit('ip:1', LIMITS.ADMIN_LOGIN);
    expect(sixth.allowed).toBe(false);
    expect(sixth.retryAfterMs).toBe(15 * 60_000 - 5000);
  });

  it('se libère quand la fenêtre a glissé', async () => {
    let t = 0;
    const rl = createMemoryLimiter(() => t);
    for (let i = 0; i < 3; i++) await rl.hit('contact', LIMITS.LOST_LINK);
    expect((await rl.hit('contact', LIMITS.LOST_LINK)).allowed).toBe(false);
    t = 60 * 60_000 + 1;
    expect((await rl.hit('contact', LIMITS.LOST_LINK)).allowed).toBe(true);
  });

  it('compte séparément chaque clé (IP, contact)', async () => {
    const rl = createMemoryLimiter(() => 0);
    for (let i = 0; i < 3; i++) await rl.hit('a', LIMITS.LOST_LINK);
    expect((await rl.hit('a', LIMITS.LOST_LINK)).allowed).toBe(false);
    expect((await rl.hit('b', LIMITS.LOST_LINK)).allowed).toBe(true);
  });

  it('une tentative refusée ne prolonge pas le blocage', async () => {
    let t = 0;
    const rl = createMemoryLimiter(() => t);
    for (let i = 0; i < 3; i++) await rl.hit('k', LIMITS.LOST_LINK);
    t = 30 * 60_000;
    await rl.hit('k', LIMITS.LOST_LINK);
    t = 60 * 60_000 + 1;
    expect((await rl.hit('k', LIMITS.LOST_LINK)).allowed).toBe(true);
  });

  it('decide() est pure', () => {
    expect(decide([], 0, { limit: 1, windowMs: 10 })).toMatchObject({ allowed: true, remaining: 0 });
    expect(decide([5], 6, { limit: 1, windowMs: 10 })).toMatchObject({ allowed: false, retryAfterMs: 9 });
  });

  it('hache les clés (aucune IP ni email en clair)', () => {
    const k = hashKey('lost', ' Marie@Example.re ');
    expect(k).toMatch(/^lost:/);
    expect(k).not.toContain('marie');
    expect(k).toBe(hashKey('lost', 'marie@example.re'));
  });
});
