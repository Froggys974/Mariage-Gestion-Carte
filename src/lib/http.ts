/** Réponses JSON et lecture validée (Zod) des corps de requête. */
import type { z } from 'zod';

export const MAX_JSON_BYTES = 32_768;

export function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set('content-type', 'application/json; charset=utf-8');
  headers.set('cache-control', 'no-store');
  return new Response(JSON.stringify(data), { ...init, headers });
}

export function problem(status: number, code: string, extra: Record<string, unknown> = {}): Response {
  return json({ error: code, ...extra }, { status });
}

export type Parsed<T> = { ok: true; data: T } | { ok: false; response: Response };

/** Lit un corps JSON borné en taille et le valide. 400 si invalide, 413 si trop gros. */
export async function readJson<S extends z.ZodType>(
  request: Request,
  schema: S,
  maxBytes = MAX_JSON_BYTES,
): Promise<Parsed<z.infer<S>>> {
  const length = Number(request.headers.get('content-length') ?? 0);
  if (length > maxBytes) return { ok: false, response: problem(413, 'too_large') };
  let text: string;
  try {
    text = await request.text();
  } catch {
    return { ok: false, response: problem(400, 'bad_body') };
  }
  if (Buffer.byteLength(text) > maxBytes) return { ok: false, response: problem(413, 'too_large') };
  let raw: unknown;
  try {
    raw = text ? JSON.parse(text) : {};
  } catch {
    return { ok: false, response: problem(400, 'bad_json') };
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    return {
      ok: false,
      response: problem(400, 'invalid', {
        issues: result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      }),
    };
  }
  return { ok: true, data: result.data };
}

/** IP du client ; derrière Caddy (TRUST_PROXY=true), première adresse de X-Forwarded-For. */
export function clientIp(request: Request, fallback: string | undefined, trustProxy: boolean): string {
  if (trustProxy) {
    const xff = request.headers.get('x-forwarded-for');
    const first = xff?.split(',')[0]?.trim();
    if (first) return first;
  }
  return fallback ?? 'unknown';
}
