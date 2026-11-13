/**
 * Source unique de configuration : valide process.env avec Zod.
 * Une variable manquante ou invalide empêche le démarrage, avec un message explicite.
 */
import { existsSync } from 'node:fs';
import { z } from 'zod';

const bool = z
  .enum(['true', 'false', '1', '0', 'yes', 'no', ''])
  .default('false')
  .transform((v) => v === 'true' || v === '1' || v === 'yes');

const optionalString = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() !== '' ? v.trim() : undefined));

const argon2Hash = z.string().regex(/^\$argon2id\$/, 'doit être un hash argon2id (pnpm create-admin-hash)');

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    HOST: z.string().default('0.0.0.0'),
    PORT: z.coerce.number().int().positive().default(4321),
    PUBLIC_URL: z.url().transform((u) => u.replace(/\/+$/, '')),
    DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\//, 'doit commencer par postgres://'),
    SESSION_SECRET: z.string().min(32, 'au moins 32 caractères aléatoires'),
    TRUST_PROXY: bool,
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

    ADMIN_EMAIL: z.email().transform((e) => e.toLowerCase()),
    ADMIN_PASSWORD_HASH: argon2Hash,
    ADMIN2_EMAIL: optionalString.pipe(z.email().optional()),
    ADMIN2_PASSWORD_HASH: optionalString,

    EMAIL_PROVIDER: z.enum(['smtp', 'fake']).default('smtp'),
    SMTP_HOST: optionalString,
    SMTP_PORT: z.coerce.number().int().positive().default(587),
    SMTP_SECURE: optionalString,
    SMTP_USER: optionalString,
    SMTP_PASS: optionalString,
    MAIL_FROM: z.string().min(3),
    MAIL_REPLY_TO: optionalString,
    EMAIL_WEBHOOK_SECRET: optionalString,

    WHATSAPP_PROVIDER: z.enum(['cloud', 'fake']).default('fake'),
    WHATSAPP_PHONE_NUMBER_ID: optionalString,
    WHATSAPP_TOKEN: optionalString,
    WHATSAPP_TEMPLATE_NAME: z.string().default('faire_part_invitation'),
    WHATSAPP_TEMPLATE_LANG: z.string().default('fr'),
    WHATSAPP_OTP_TEMPLATE_NAME: z.string().default('code_verification'),
    WHATSAPP_APP_SECRET: optionalString,
    WHATSAPP_VERIFY_TOKEN: optionalString,
    WHATSAPP_API_VERSION: z.string().default('v26.0'),

    UPLOAD_DIR: z.string().default('./data/uploads'),
    WORKER_SEND_INTERVAL_MS: z.coerce.number().int().min(100).default(1000),
  })
  .superRefine((e, ctx) => {
    if (e.EMAIL_PROVIDER === 'smtp' && !e.SMTP_HOST) {
      ctx.addIssue({ code: 'custom', path: ['SMTP_HOST'], message: 'obligatoire quand EMAIL_PROVIDER=smtp' });
    }
    if (e.WHATSAPP_PROVIDER === 'cloud') {
      for (const k of [
        'WHATSAPP_PHONE_NUMBER_ID',
        'WHATSAPP_TOKEN',
        'WHATSAPP_APP_SECRET',
        'WHATSAPP_VERIFY_TOKEN',
      ] as const) {
        if (!e[k])
          ctx.addIssue({ code: 'custom', path: [k], message: 'obligatoire quand WHATSAPP_PROVIDER=cloud' });
      }
    }
    if (Boolean(e.ADMIN2_EMAIL) !== Boolean(e.ADMIN2_PASSWORD_HASH)) {
      ctx.addIssue({
        code: 'custom',
        path: ['ADMIN2_PASSWORD_HASH'],
        message: 'ADMIN2_EMAIL et ADMIN2_PASSWORD_HASH vont ensemble',
      });
    }
    if (e.ADMIN2_PASSWORD_HASH && !e.ADMIN2_PASSWORD_HASH.startsWith('$argon2id$')) {
      ctx.addIssue({ code: 'custom', path: ['ADMIN2_PASSWORD_HASH'], message: 'doit être un hash argon2id' });
    }
  });

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

/** Charge `.env` hors production (en production, Docker fournit les variables). */
function loadDotEnv(): void {
  if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'test') return;
  if (existsSync('.env')) {
    try {
      process.loadEnvFile('.env');
    } catch {
      /* fichier illisible : la validation dira ce qui manque */
    }
  }
}

export function parseEnv(source: NodeJS.ProcessEnv): Env {
  const result = schema.safeParse(source);
  if (!result.success) {
    const lines = result.error.issues.map((i) => `  - ${i.path.join('.') || '(racine)'} : ${i.message}`);
    throw new Error(`Configuration invalide (.env) :\n${lines.join('\n')}`);
  }
  return result.data;
}

export function getEnv(): Env {
  if (!cached) {
    loadDotEnv();
    cached = parseEnv(process.env);
  }
  return cached;
}

/** Vrai si les cookies doivent porter l'attribut Secure (site servi en HTTPS). */
export function isHttps(): boolean {
  return getEnv().PUBLIC_URL.startsWith('https://');
}

/** Pour les tests uniquement. */
export function resetEnvCache(): void {
  cached = undefined;
}
