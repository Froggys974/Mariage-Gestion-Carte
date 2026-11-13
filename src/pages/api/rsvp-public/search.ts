import type { APIRoute } from 'astro';
import { z } from 'zod';
import { getSiteSettings } from '~/features/card/card.service';
import { startChallenge } from '~/features/rsvp/lookup.service';
import { getDb } from '~/lib/db/client';
import { getEnv } from '~/lib/env';
import { clientIp, json, problem, readJson } from '~/lib/http';
import { createDbLimiter, hashKey, LIMITS } from '~/lib/rate-limit';

const body = z.object({ first: z.string().trim().min(1).max(80), last: z.string().trim().min(1).max(80) });

/** Étape 1 du lien public : recherche tolérante + envoi du code. Même réponse si le nom est inconnu. */
export const POST: APIRoute = async ({ request, clientAddress }) => {
  const db = getDb();
  if (!(await getSiteSettings(db)).publicRsvpEnabled) return problem(404, 'disabled');
  const parsed = await readJson(request, body);
  if (!parsed.ok) return parsed.response;
  const ip = clientIp(request, clientAddress, getEnv().TRUST_PROXY);
  const d = await createDbLimiter(db).hit(hashKey('rsvp-search', ip), LIMITS.RSVP_SEARCH);
  if (!d.allowed) return problem(429, 'too_many');
  return json(await startChallenge(db, parsed.data.first, parsed.data.last));
};
