/** Enveloppe commune des routes /api/rsvp/:token/* : erreurs métier → codes HTTP, journaux sans token. */
import { json, problem } from '~/lib/http';
import { logger } from '~/lib/logger';
import { RsvpError, rsvpErrorStatus } from './rsvp.service';

export async function rsvpRoute(action: string, fn: () => Promise<unknown>): Promise<Response> {
  try {
    const data = await fn();
    return data === undefined ? new Response(null, { status: 204 }) : json(data);
  } catch (err) {
    if (err instanceof RsvpError) {
      return problem(rsvpErrorStatus(err.code), err.code, err.state ? { state: err.state } : {});
    }
    logger.error({ err, action }, 'rsvp : erreur');
    return problem(500, 'server_error');
  }
}
