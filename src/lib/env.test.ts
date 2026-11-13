import { describe, expect, it } from 'vitest';
import { parseEnv } from './env';

const base = {
  PUBLIC_URL: 'http://localhost:4321/',
  DATABASE_URL: 'postgres://u:p@localhost:5432/db',
  SESSION_SECRET: 'x'.repeat(40),
  ADMIN_EMAIL: 'Maries@Example.re',
  ADMIN_PASSWORD_HASH: '$argon2id$v=19$m=19456,t=2,p=1$abc$def',
  MAIL_FROM: 'Mariage <mariage@example.re>',
  SMTP_HOST: 'localhost',
};

describe('parseEnv', () => {
  it('accepte une configuration minimale et normalise', () => {
    const env = parseEnv(base);
    expect(env.PUBLIC_URL).toBe('http://localhost:4321');
    expect(env.ADMIN_EMAIL).toBe('maries@example.re');
    expect(env.WHATSAPP_PROVIDER).toBe('fake');
    expect(env.TRUST_PROXY).toBe(false);
  });
  it('refuse de démarrer si une variable obligatoire manque', () => {
    const { DATABASE_URL: _omit, ...rest } = base;
    expect(() => parseEnv(rest)).toThrow(/DATABASE_URL/);
  });
  it('exige les variables WhatsApp en mode cloud', () => {
    expect(() => parseEnv({ ...base, WHATSAPP_PROVIDER: 'cloud' })).toThrow(/WHATSAPP_TOKEN/);
  });
  it('exige un hash argon2id', () => {
    expect(() => parseEnv({ ...base, ADMIN_PASSWORD_HASH: 'motdepasse' })).toThrow(/argon2id/);
  });
  it('exige les deux variables du second admin ensemble', () => {
    expect(() => parseEnv({ ...base, ADMIN2_EMAIL: 'b@example.re' })).toThrow(/ADMIN2/);
  });
});
