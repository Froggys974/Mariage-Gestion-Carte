/** Hachage des mots de passe admin : argon2id, paramètres recommandés OWASP. */
import { hash, verify, type Algorithm } from '@node-rs/argon2';

export const PASSWORD_MIN_LENGTH = 12;

/** Valeur de l'enum const `Algorithm.Argon2id` (inaccessible avec isolatedModules). */
const ARGON2ID = 2 as Algorithm;
const OPTIONS = { algorithm: ARGON2ID, memoryCost: 19456, timeCost: 2, parallelism: 1 };

export function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS);
}

export async function verifyPassword(stored: string, password: string): Promise<boolean> {
  try {
    return await verify(stored, password);
  } catch {
    return false;
  }
}
