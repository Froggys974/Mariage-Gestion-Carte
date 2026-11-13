import type { APIRoute } from 'astro';
import { submitBody } from '~/features/rsvp/rsvp.schema';
import { submitResponse } from '~/features/rsvp/rsvp.service';
import { rsvpRoute } from '~/features/rsvp/rsvp.http';
import { getDb } from '~/lib/db/client';
import { readJson } from '~/lib/http';

/** Envoi de la réponse : remplace entièrement la précédente. */
export const POST: APIRoute = async ({ params, request }) => {
  const body = await readJson(request, submitBody);
  if (!body.ok) return body.response;
  return rsvpRoute('submit', () =>
    submitResponse(getDb(), params.token ?? '', body.data.seats, body.data.expectedUpdatedAt),
  );
};
