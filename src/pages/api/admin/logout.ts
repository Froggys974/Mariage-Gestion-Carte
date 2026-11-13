import type { APIRoute } from 'astro';
import { destroySession, SESSION } from '~/lib/auth/session';
import { getDb } from '~/lib/db/client';

/** Déconnexion (formulaire avec jeton CSRF, vérifié par le middleware). */
export const POST: APIRoute = async ({ cookies, redirect }) => {
  await destroySession(getDb(), cookies.get(SESSION.COOKIE)?.value);
  cookies.delete(SESSION.COOKIE, { path: '/' });
  return redirect('/admin/login', 303);
};
