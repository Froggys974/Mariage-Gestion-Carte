/** Enveloppe des routes /api/admin/* : erreurs → JSON, journal sans données personnelles. */
import { json, problem } from '~/lib/http';
import { logger } from '~/lib/logger';
import { DuplicateContactError, VersionConflictError } from './invitations.service';

export async function adminRoute(action: string, fn: () => Promise<unknown>): Promise<Response> {
  try {
    const data = await fn();
    return data instanceof Response ? data : json(data ?? { ok: true });
  } catch (err) {
    if (err instanceof VersionConflictError) return problem(409, 'conflict');
    if (err instanceof DuplicateContactError) return problem(409, 'duplicate');
    if (err instanceof Error && err.message === 'not_found') return problem(404, 'not_found');
    if (err instanceof Error && err.message === 'contact') return problem(400, 'contact');
    logger.error({ err, action }, 'admin : erreur');
    return problem(500, 'server_error');
  }
}

export function csvResponse(csv: string, filename: string): Response {
  return new Response(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${filename}"`,
      'cache-control': 'no-store',
    },
  });
}
