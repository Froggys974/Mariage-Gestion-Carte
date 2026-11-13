/**
 * Sessions admin en base : cookie HttpOnly, Secure (HTTPS), SameSite=Lax, 7 jours,
 * renouvelée (nouvelle session) à chaque connexion. Le cookie ne contient qu'un jeton aléatoire ;
 * la base n'en garde que le sha256.
 */
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { eq, lt } from 'drizzle-orm';
import type { DbOrTx } from '../db/client';
import { adminSession } from '../db/schema';
import { getEnv } from '../env';
import { verifyPassword } from './password';

export const SESSION = {
  COOKIE: 'rcgn_admin',
  LOGIN_CSRF_COOKIE: 'rcgn_login_csrf',
  TTL_MS: 7 * 24 * 60 * 60_000,
  TOKEN_BYTES: 32,
} as const;

export interface AdminIdentity {
  email: string;
  csrfToken: string;
  sessionId: string;
}

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');
export const randomToken = (bytes: number = SESSION.TOKEN_BYTES) => randomBytes(bytes).toString('base64url');

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Admins déclarés dans .env (un principal, un second facultatif). */
export function admins(): Array<{ email: string; hash: string }> {
  const env = getEnv();
  const list = [{ email: env.ADMIN_EMAIL, hash: env.ADMIN_PASSWORD_HASH }];
  if (env.ADMIN2_EMAIL && env.ADMIN2_PASSWORD_HASH) {
    list.push({ email: env.ADMIN2_EMAIL.toLowerCase(), hash: env.ADMIN2_PASSWORD_HASH });
  }
  return list;
}

/** Vérifie email + mot de passe. Le temps de réponse ne révèle pas si l'email existe. */
export async function authenticate(email: string, password: string): Promise<string | null> {
  const wanted = email.trim().toLowerCase();
  const all = admins();
  const match = all.find((a) => a.email === wanted);
  const ok = await verifyPassword(match?.hash ?? all[0]!.hash, password);
  return match && ok ? match.email : null;
}

export async function createSession(db: DbOrTx, email: string): Promise<{ token: string; expires: Date }> {
  const token = randomToken();
  const expires = new Date(Date.now() + SESSION.TTL_MS);
  await db
    .insert(adminSession)
    .values({ id: sha256(token), adminEmail: email, csrfToken: randomToken(), expiresAt: expires });
  return { token, expires };
}

export async function readSession(db: DbOrTx, token: string | undefined): Promise<AdminIdentity | null> {
  if (!token || token.length > 100) return null;
  const id = sha256(token);
  const [row] = await db.select().from(adminSession).where(eq(adminSession.id, id));
  if (!row || row.expiresAt.getTime() < Date.now()) return null;
  // un admin retiré du .env perd l'accès immédiatement
  if (!admins().some((a) => a.email === row.adminEmail)) return null;
  return { email: row.adminEmail, csrfToken: row.csrfToken, sessionId: id };
}

export async function destroySession(db: DbOrTx, token: string | undefined): Promise<void> {
  if (!token) return;
  await db.delete(adminSession).where(eq(adminSession.id, sha256(token)));
}

export async function purgeExpiredSessions(db: DbOrTx): Promise<void> {
  await db.delete(adminSession).where(lt(adminSession.expiresAt, new Date()));
}
