/** Token des liens personnels : 128 bits aléatoires, encodés en base64url (22 caractères). */
import { randomBytes } from 'node:crypto';

export const TOKEN_BYTES = 16;
const TOKEN_RE = /^[A-Za-z0-9_-]{22}$/;

export function generateToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url');
}

/** Vérifie la forme avant toute requête en base (rejette les URL fantaisistes sans coût). */
export function isTokenShape(value: string): boolean {
  return TOKEN_RE.test(value);
}

export function personalLink(publicUrl: string, token: string): string {
  return `${publicUrl}/i/${token}`;
}
