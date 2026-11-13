import { describe, expect, it } from 'vitest';
import { contentSecurityPolicy, injectNonce, originAllowed, securityHeaders } from './security';

describe('en-têtes de sécurité', () => {
  it('CSP stricte : scripts et styles limités à self + nonce', () => {
    const csp = contentSecurityPolicy('abc', true);
    expect(csp).toContain("script-src 'self' 'nonce-abc'");
    expect(csp).not.toMatch(/script-src[^;]*unsafe-inline/);
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain('upgrade-insecure-requests');
  });
  it('noindex, nosniff, same-origin, HSTS en HTTPS', () => {
    const h = securityHeaders({ nonce: 'n', https: true, csp: true });
    expect(h['x-robots-tag']).toMatch(/noindex/);
    expect(h['x-content-type-options']).toBe('nosniff');
    expect(h['referrer-policy']).toBe('same-origin');
    expect(h['strict-transport-security']).toMatch(/max-age=31536000/);
  });
  it('pas de HSTS en HTTP local', () => {
    expect(
      securityHeaders({ nonce: 'n', https: false, csp: false })['strict-transport-security'],
    ).toBeUndefined();
  });
  it('ajoute le nonce à chaque script et style', () => {
    const html = '<script type="module" src="/a.js"></script><style>a{}</style><script nonce="x">1</script>';
    expect(injectNonce(html, 'N')).toBe(
      '<script nonce="N" type="module" src="/a.js"></script><style nonce="N">a{}</style><script nonce="x">1</script>',
    );
  });
});

describe('contrôle d’origine', () => {
  const req = (h: Record<string, string>) =>
    new Request('http://localhost:4321/api/x', { method: 'POST', headers: h });
  it('accepte notre origine', () => {
    expect(originAllowed(req({ origin: 'https://m.re' }), ['https://m.re'])).toBe(true);
  });
  it('refuse une autre origine ou l’absence d’origine', () => {
    expect(originAllowed(req({ origin: 'https://evil.example' }), ['https://m.re'])).toBe(false);
    expect(originAllowed(req({}), ['https://m.re'])).toBe(false);
  });
  it('se rabat sur le Referer', () => {
    expect(originAllowed(req({ referer: 'https://m.re/admin' }), ['https://m.re'])).toBe(true);
  });
});
