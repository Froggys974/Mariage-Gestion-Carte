/**
 * Contrôles d'une adresse email au moment de la saisie (espace des mariés) :
 * - faute de frappe probable dans un fournisseur courant (gmial.com → gmail.com) ;
 * - domaine qui n'existe pas ou ne reçoit pas d'emails (DNS : MX, sinon A / AAAA, RFC 5321 § 5.1).
 * Un doute (DNS lent ou injoignable) ne bloque jamais la saisie : seul un « non » net est signalé.
 */
import { promises as dns } from 'node:dns';

/** Fournisseurs les plus courants en France et à La Réunion. */
export const COMMON_DOMAINS = [
  'gmail.com',
  'googlemail.com',
  'hotmail.com',
  'hotmail.fr',
  'outlook.com',
  'outlook.fr',
  'live.com',
  'live.fr',
  'msn.com',
  'yahoo.com',
  'yahoo.fr',
  'icloud.com',
  'me.com',
  'mac.com',
  'orange.fr',
  'wanadoo.fr',
  'free.fr',
  'sfr.fr',
  'neuf.fr',
  'laposte.net',
  'bbox.fr',
  'gmx.fr',
  'gmx.com',
  'gmx.de',
  'aol.com',
  'aol.fr',
  'mail.com',
  'protonmail.com',
  'proton.me',
] as const;

/** Fautes fréquentes trop éloignées pour la distance d'édition. */
const KNOWN_TYPOS: Record<string, string> = {
  'gmail.fr': 'gmail.com',
  'gmail.re': 'gmail.com',
};

/** Distance de Damerau-Levenshtein restreinte (une inversion de deux lettres compte pour 1). */
export function editDistance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
        v = Math.min(v, d[i - 2]![j - 2]! + 1);
      d[i]![j] = v;
    }
  }
  return d[a.length]![b.length]!;
}

/** Adresse corrigée si le domaine ressemble de très près à un fournisseur courant, sinon null. */
export function suggestEmail(email: string): string | null {
  const at = email.lastIndexOf('@');
  if (at < 1) return null;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1).toLowerCase();
  if ((COMMON_DOMAINS as readonly string[]).includes(domain)) return null;
  const known = KNOWN_TYPOS[domain];
  if (known) return `${local}@${known}`;
  const max = domain.length >= 11 ? 2 : 1;
  let best: { d: string; n: number } | null = null;
  for (const d of COMMON_DOMAINS) {
    const n = editDistance(domain, d);
    if (n <= max && (!best || n < best.n)) best = { d, n };
  }
  return best ? `${local}@${best.d}` : null;
}

export type DomainStatus = 'ok' | 'no_mail' | 'unknown';

export interface DnsResolver {
  resolveMx(domain: string): Promise<Array<{ exchange: string; priority: number }>>;
  resolve4(domain: string): Promise<string[]>;
  resolve6(domain: string): Promise<string[]>;
}

/** Domaines réservés aux tests (RFC 2606 / 6761) : jamais interrogés. */
export function isReservedDomain(domain: string): boolean {
  return (
    /\.(test|example|invalid|localhost|local)$/i.test(domain) || /(^|\.)example\.(com|net|org)$/i.test(domain)
  );
}

const codeOf = (e: unknown) => (e as { code?: string }).code ?? '';
const ABSENT = new Set(['ENOTFOUND', 'ENODATA']);

async function hasAddress(domain: string, r: DnsResolver): Promise<DomainStatus> {
  for (const lookup of [r.resolve4.bind(r), r.resolve6.bind(r)]) {
    try {
      if ((await lookup(domain)).length > 0) return 'ok';
    } catch (e) {
      if (!ABSENT.has(codeOf(e))) return 'unknown';
    }
  }
  return 'no_mail';
}

async function lookupDomain(domain: string, r: DnsResolver): Promise<DomainStatus> {
  try {
    const mx = await r.resolveMx(domain);
    if (mx.length === 0) return hasAddress(domain, r);
    // « null MX » (RFC 7505) : le domaine annonce qu'il ne reçoit aucun email
    if (mx.every((m) => m.exchange === '' || m.exchange === '.')) return 'no_mail';
    return 'ok';
  } catch (e) {
    const code = codeOf(e);
    if (code === 'ENOTFOUND') return 'no_mail';
    if (code === 'ENODATA') return hasAddress(domain, r);
    return 'unknown';
  }
}

/** Le domaine de l'adresse peut-il recevoir des emails ? */
export async function checkMailDomain(
  email: string,
  resolver: DnsResolver = dns,
  timeoutMs = 4000,
): Promise<DomainStatus> {
  const domain = email.slice(email.lastIndexOf('@') + 1).toLowerCase();
  if (!domain || isReservedDomain(domain)) return 'ok';
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<DomainStatus>((resolve) => {
    timer = setTimeout(() => resolve('unknown'), timeoutMs);
  });
  try {
    return await Promise.race([lookupDomain(domain, resolver), timeout]);
  } finally {
    clearTimeout(timer);
  }
}
