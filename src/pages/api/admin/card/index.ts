import type { APIRoute } from 'astro';
import { adminRoute } from '~/features/admin/admin.http';
import {
  cardBody,
  CardConflictError,
  loadEditorData,
  settingsBody,
  updateCard,
  updateSiteSettings,
} from '~/features/card/card.admin';
import { getDb } from '~/lib/db/client';
import { fromDateInput } from '~/lib/dates';
import { problem, readJson } from '~/lib/http';

/** Enregistre le contenu de la carte. */
export const PUT: APIRoute = async ({ request }) => {
  const body = await readJson(request, cardBody);
  if (!body.ok) return body.response;
  return adminRoute('card', async () => {
    const db = getDb();
    try {
      await updateCard(db, body.data);
    } catch (err) {
      if (err instanceof CardConflictError) return problem(409, 'conflict');
      throw err;
    }
    return loadEditorData(db);
  });
};

/** Réglages : date limite, lien public /rsvp, date d'effacement des données de santé. */
export const PATCH: APIRoute = async ({ request }) => {
  const body = await readJson(request, settingsBody);
  if (!body.ok) return body.response;
  return adminRoute('settings', async () => {
    const db = getDb();
    await updateSiteSettings(db, {
      rsvpDeadline: fromDateInput(body.data.rsvpDeadline, true),
      publicRsvpEnabled: body.data.publicRsvpEnabled,
      purgeAt: fromDateInput(body.data.purgeAt, false),
    });
    return loadEditorData(db);
  });
};
