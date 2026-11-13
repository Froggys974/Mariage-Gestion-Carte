/**
 * En-têtes de sécurité et CSP stricte (nonce par requête).
 * Aucun script ni style en ligne n'est autorisé sans le nonce ; les attributs style sont tolérés
 * (positions dynamiques de l'admin) mais le site invité n'en émet pas.
 */
import { randomBytes } from 'node:crypto';

export function newNonce(): string {
  return randomBytes(16).toString('base64');
}

export function contentSecurityPolicy(nonce: string, https: boolean): string {
  const d = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    `style-src 'self' 'nonce-${nonce}'`,
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "media-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "worker-src 'none'",
    "manifest-src 'self'",
  ];
  if (https) d.push('upgrade-insecure-requests');
  return d.join('; ');
}

export interface SecurityOptions {
  nonce: string;
  https: boolean;
  /** CSP désactivée en développement (Vite injecte styles et scripts) */
  csp: boolean;
}

export function securityHeaders(o: SecurityOptions): Record<string, string> {
  const h: Record<string, string> = {
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'same-origin',
    'x-frame-options': 'DENY',
    'x-robots-tag': 'noindex, nofollow, noarchive',
    'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
    'cross-origin-opener-policy': 'same-origin',
    'cross-origin-resource-policy': 'same-origin',
  };
  if (o.csp) h['content-security-policy'] = contentSecurityPolicy(o.nonce, o.https);
  if (o.https) h['strict-transport-security'] = 'max-age=31536000; includeSubDomains';
  return h;
}

/** Ajoute le nonce à chaque <script> et <style> du HTML rendu (scripts d'îlots Astro compris). */
export function injectNonce(html: string, nonce: string): string {
  return html.replace(/<(script|style)\b(?![^>]*\bnonce=)/gi, `<$1 nonce="${nonce}"`);
}

/** L'origine de la requête est-elle la nôtre ? (protection CSRF de base pour tout POST/PUT/DELETE) */
export function originAllowed(request: Request, allowed: readonly string[]): boolean {
  const origin = request.headers.get('origin');
  if (origin) return allowed.includes(origin);
  const referer = request.headers.get('referer');
  if (referer) {
    try {
      return allowed.includes(new URL(referer).origin);
    } catch {
      return false;
    }
  }
  return false;
}
