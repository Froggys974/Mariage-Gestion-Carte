import type { APIRoute } from 'astro';
import { declineBody } from '~/features/rsvp/rsvp.schema';
import { declineResponse } from '~/features/rsvp/rsvp.service';
import { rsvpRoute } from '~/features/rsvp/rsvp.http';
import { getDb } from '~/lib/db/client';
import { readJson } from '~/lib/http';

/** « Nous ne pourrons pas venir ». */
export const POST: APIRoute = async ({ params, request }) => {
  const body = await readJson(request, declineBody);
  if (!body.ok) return body.response;
  return rsvpRoute('decline', () =>
    declineResponse(getDb(), params.token ?? '', body.data.expectedUpdatedAt),
  );
};
