import type { APIRoute } from 'astro';
import { CARD_EMAIL, CardEmailError, requestCardEmail } from '~/features/card/card-email.service';
import { getDb } from '~/lib/db/client';
import { getEnv } from '~/lib/env';
import { clientIp, json, problem } from '~/lib/http';
import { logger } from '~/lib/logger';
import { createDbLimiter, hashKey, LIMITS } from '~/lib/rate-limit';
import { getStorage } from '~/lib/storage/storage';

const STATUS: Record<string, number> = {
  not_found: 404,
  too_many: 429,
  email: 400,
  email_domain: 400,
  image: 400,
};

/** « Recevoir par email » : formulaire multipart (email + carte en PNG dessinée par le navigateur). */
export const POST: APIRoute = async ({ params, request, clientAddress }) => {
  if (Number(request.headers.get('content-length') ?? 0) > CARD_EMAIL.MAX_BYTES + 50_000) {
    return problem(413, 'too_large');
  }
  const db = getDb();
  const ip = clientIp(request, clientAddress, getEnv().TRUST_PROXY);
  const byIp = await createDbLimiter(db).hit(hashKey('card-email-ip', ip), LIMITS.CARD_EMAIL);
  if (!byIp.allowed) return problem(429, 'too_many');

  let email: string;
  let png: Buffer;
  try {
    const form = await request.formData();
    email = String(form.get('email') ?? '');
    const card = form.get('card');
    if (!(card instanceof File)) return problem(400, 'image');
    png = Buffer.from(await card.arrayBuffer());
  } catch {
    return problem(400, 'bad_form');
  }
  try {
    const r = await requestCardEmail(db, getStorage(), { token: params.token ?? '', email, png });
    logger.info({ remaining: r.remaining }, 'carte par email : demande');
    return json({ ok: true, to: r.to, remaining: r.remaining });
  } catch (err) {
    if (err instanceof CardEmailError) return problem(STATUS[err.code] ?? 400, err.code, err.extra);
    logger.error({ err }, 'carte par email : erreur');
    return problem(500, 'server_error');
  }
};
