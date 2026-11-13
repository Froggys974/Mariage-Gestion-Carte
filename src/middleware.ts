/**
 * Middleware unique :
 * 1. contrôle d'origine sur toutes les requêtes qui modifient des données (sauf webhooks signés) ;
 * 2. protection de /admin/* et /api/admin/* (session) + jeton CSRF sur les actions ;
 * 3. en-têtes de sécurité, CSP avec nonce, noindex ;
 * 4. journal des requêtes sans token ni donnée personnelle.
 */
import { defineMiddleware } from 'astro:middleware';
import { readSession, safeEqual, SESSION } from './lib/auth/session';
import { getDb } from './lib/db/client';
import { getEnv } from './lib/env';
import { problem } from './lib/http';
import { logger, scrubPath } from './lib/logger';
import { injectNonce, newNonce, originAllowed, securityHeaders } from './lib/security';

const OPEN_ADMIN_PAGES = new Set(['/admin/login']);
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function isAdminPage(path: string): boolean {
  return (path === '/admin' || path.startsWith('/admin/')) && !OPEN_ADMIN_PAGES.has(path);
}

async function sentCsrf(request: Request): Promise<string | null> {
  const header = request.headers.get('x-csrf-token');
  if (header) return header;
  const type = request.headers.get('content-type') ?? '';
  if (type.includes('application/x-www-form-urlencoded') || type.includes('multipart/form-data')) {
    try {
      const v = (await request.clone().formData()).get('_csrf');
      return typeof v === 'string' ? v : null;
    } catch {
      return null;
    }
  }
  return null;
}

export const onRequest = defineMiddleware(async (ctx, next) => {
  const started = performance.now();
  const env = getEnv();
  const { pathname } = ctx.url;
  const method = ctx.request.method;
  const nonce = newNonce();
  ctx.locals.nonce = nonce;

  const finish = async (res: Response): Promise<Response> => {
    const prod = env.NODE_ENV === 'production';
    const headers = new Headers(res.headers);
    for (const [k, v] of Object.entries(
      securityHeaders({ nonce, https: env.PUBLIC_URL.startsWith('https://'), csp: prod }),
    )) {
      headers.set(k, v);
    }
    let out: Response;
    if (prod && (headers.get('content-type') ?? '').includes('text/html') && res.body) {
      headers.delete('content-length');
      out = new Response(injectNonce(await res.text(), nonce), {
        status: res.status,
        statusText: res.statusText,
        headers,
      });
    } else {
      out = new Response(res.body, { status: res.status, statusText: res.statusText, headers });
    }
    if (!pathname.startsWith('/_astro/') && !pathname.startsWith('/media/') && pathname !== '/api/health') {
      logger.info(
        {
          method,
          path: scrubPath(pathname),
          status: out.status,
          ms: Math.round(performance.now() - started),
        },
        'requête',
      );
    }
    return out;
  };

  const mutating = !SAFE_METHODS.has(method);
  if (mutating && !pathname.startsWith('/api/webhooks/')) {
    const allowed = [new URL(env.PUBLIC_URL).origin];
    if (env.NODE_ENV !== 'production') allowed.push(ctx.url.origin);
    if (!originAllowed(ctx.request, allowed)) return finish(problem(403, 'bad_origin'));
  }

  const adminApi = pathname.startsWith('/api/admin/') && pathname !== '/api/admin/login';
  if (isAdminPage(pathname) || adminApi) {
    const admin = await readSession(getDb(), ctx.cookies.get(SESSION.COOKIE)?.value);
    if (!admin) {
      if (adminApi) return finish(problem(401, 'unauthorized'));
      const nextUrl = encodeURIComponent(pathname + ctx.url.search);
      return finish(ctx.redirect(`/admin/login?next=${nextUrl}`, 303));
    }
    if (mutating) {
      const token = await sentCsrf(ctx.request);
      if (!token || !safeEqual(token, admin.csrfToken)) return finish(problem(403, 'csrf'));
    }
    ctx.locals.admin = admin;
  }

  return finish(await next());
});
