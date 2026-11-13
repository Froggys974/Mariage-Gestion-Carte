// Variables minimales pour les tests ; les tests d'intégration utilisent TEST_DATABASE_URL (base jetable).
const defaults: Record<string, string> = {
  PUBLIC_URL: 'http://localhost:4321',
  DATABASE_URL: process.env.TEST_DATABASE_URL ?? 'postgres://test:test@localhost:5432/test',
  SESSION_SECRET: 'test-secret-test-secret-test-secret-0000',
  ADMIN_EMAIL: 'maries@mariage.test',
  ADMIN_PASSWORD_HASH:
    '$argon2id$v=19$m=19456,t=2,p=1$5O72idxnErqv9hXyXNqXRA$hV7/GwoNHXVRtMwWYAn2VY7cH5L97qlhU8xpdBNB6oE',
  MAIL_FROM: 'Mariage <mariage@mariage.test>',
  EMAIL_PROVIDER: 'fake',
  WHATSAPP_PROVIDER: 'fake',
  WHATSAPP_APP_SECRET: 'test-app-secret',
  WHATSAPP_VERIFY_TOKEN: 'test-verify',
  LOG_LEVEL: 'silent',
};
for (const [k, v] of Object.entries(defaults)) process.env[k] ??= v;
