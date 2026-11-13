/**
 * Limites anti-abus en fenêtre glissante (connexion admin, « lien perdu », /rsvp).
 * Les clés (IP, email, téléphone) sont hachées (HMAC) : aucune donnée personnelle en clair en base.
 * Stockage en PostgreSQL : les limites survivent aux redémarrages.
 */
import { createHmac } from 'node:crypto';
import { and, eq, gt, lt, sql } from 'drizzle-orm';
import type { DbOrTx } from './db/client';
import { rateLimitHit } from './db/schema';
import { getEnv } from './env';

export const LIMITS = {
  /** connexion admin : 5 essais toutes les 15 minutes par IP */
  ADMIN_LOGIN: { limit: 5, windowMs: 15 * 60_000 },
  /** « lien perdu » : 3 demandes par heure par contact et par IP */
  LOST_LINK: { limit: 3, windowMs: 60 * 60_000 },
  /** « Recevoir la carte par email » : 10 demandes par heure par IP (en plus de 3 par invitation) */
  CARD_EMAIL: { limit: 10, windowMs: 60 * 60_000 },
  /** /rsvp : recherche par nom */
  RSVP_SEARCH: { limit: 5, windowMs: 60 * 60_000 },
  /** /rsvp : essais de code (par défi) */
  OTP_ATTEMPTS: 5,
  /** conservation des traces avant nettoyage */
  RETENTION_MS: 24 * 60 * 60_000,
} as const;

export interface Rule {
  limit: number;
  windowMs: number;
}

export interface Decision {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

/** Décision pure à partir des instants des tentatives déjà comptées dans la fenêtre. */
export function decide(hits: readonly number[], now: number, rule: Rule): Decision {
  const inWindow = hits.filter((t) => t > now - rule.windowMs).sort((a, b) => a - b);
  if (inWindow.length >= rule.limit) {
    const oldest = inWindow[inWindow.length - rule.limit] ?? now;
    return { allowed: false, remaining: 0, retryAfterMs: Math.max(0, oldest + rule.windowMs - now) };
  }
  return { allowed: true, remaining: rule.limit - inWindow.length - 1, retryAfterMs: 0 };
}

export interface RateLimiter {
  /** Compte une tentative et dit si elle est autorisée. */
  hit(key: string, rule: Rule): Promise<Decision>;
}

/** Implémentation mémoire (tests, développement). */
export function createMemoryLimiter(now: () => number = Date.now): RateLimiter {
  const store = new Map<string, number[]>();
  return {
    async hit(key, rule) {
      const t = now();
      const hits = (store.get(key) ?? []).filter((x) => x > t - rule.windowMs);
      const d = decide(hits, t, rule);
      if (d.allowed) hits.push(t);
      store.set(key, hits);
      return d;
    },
  };
}

export function hashKey(scope: string, value: string): string {
  return `${scope}:${createHmac('sha256', getEnv().SESSION_SECRET).update(value.trim().toLowerCase()).digest('base64url')}`;
}

/**
 * Implémentation PostgreSQL. Un verrou transactionnel par clé sérialise les tentatives simultanées :
 * deux requêtes parallèles ne peuvent pas passer toutes les deux sous la limite.
 */
export function createDbLimiter(db: DbOrTx): RateLimiter {
  return {
    hit(key, rule) {
      return db.transaction(async (tx) => {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${key}))`);
        const now = Date.now();
        const since = new Date(now - rule.windowMs);
        const rows = await tx
          .select({ at: rateLimitHit.at })
          .from(rateLimitHit)
          .where(and(eq(rateLimitHit.key, key), gt(rateLimitHit.at, since)));
        const d = decide(
          rows.map((r) => r.at.getTime()),
          now,
          rule,
        );
        if (d.allowed) await tx.insert(rateLimitHit).values({ key, at: new Date(now) });
        return d;
      });
    },
  };
}

export async function purgeOldHits(db: DbOrTx): Promise<void> {
  await db.delete(rateLimitHit).where(lt(rateLimitHit.at, sql`now() - interval '1 day'`));
}
