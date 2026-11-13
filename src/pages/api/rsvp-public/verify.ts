import type { APIRoute } from 'astro';
import { z } from 'zod';
import { getSiteSettings } from '~/features/card/card.service';
import { verifyChallenge } from '~/features/rsvp/lookup.service';
import { getDb } from '~/lib/db/client';
import { json, problem, readJson } from '~/lib/http';

const body = z.object({
  challengeId: z.uuid(),
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/),
});

/** Étape 2 : code correct → lien personnel. 5 essais par défi. */
export const POST: APIRoute = async ({ request }) => {
  const db = getDb();
  if (!(await getSiteSettings(db)).publicRsvpEnabled) return problem(404, 'disabled');
  const parsed = await readJson(request, body);
  if (!parsed.ok) return problem(400, 'bad');
  const r = await verifyChallenge(db, parsed.data.challengeId, parsed.data.code);
  return r.ok ? json({ url: `/i/${r.token}` }) : problem(r.reason === 'locked' ? 429 : 400, r.reason);
};
