import type { APIRoute } from 'astro';
import { draftBody } from '~/features/rsvp/rsvp.schema';
import { saveDraft } from '~/features/rsvp/rsvp.service';
import { rsvpRoute } from '~/features/rsvp/rsvp.http';
import { getDb } from '~/lib/db/client';
import { readJson } from '~/lib/http';

/** Enregistrement automatique du brouillon. */
export const PUT: APIRoute = async ({ params, request }) => {
  const body = await readJson(request, draftBody);
  if (!body.ok) return body.response;
  return rsvpRoute('draft', () => saveDraft(getDb(), params.token ?? '', body.data.seats));
};
