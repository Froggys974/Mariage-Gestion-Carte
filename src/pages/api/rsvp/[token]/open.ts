import type { APIRoute } from 'astro';
import { markOpened } from '~/features/rsvp/rsvp.service';
import { rsvpRoute } from '~/features/rsvp/rsvp.http';
import { getDb } from '~/lib/db/client';

/** Première ouverture du lien (appelée par le script de la page : les robots d'aperçu ne comptent pas). */
export const POST: APIRoute = ({ params }) =>
  rsvpRoute('open', async () => {
    await markOpened(getDb(), params.token ?? '');
  });
