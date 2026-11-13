import type { APIRoute } from 'astro';
import { getSql } from '~/lib/db/client';
import { logger } from '~/lib/logger';

/** Sonde de santé (HEALTHCHECK Docker, Caddy) : répond 200 si la base répond. */
export const GET: APIRoute = async () => {
  let db = false;
  try {
    await getSql()`select 1`;
    db = true;
  } catch (err) {
    logger.error({ err }, 'santé : base injoignable');
  }
  return new Response(JSON.stringify({ ok: db, db }), {
    status: db ? 200 : 503,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
};
