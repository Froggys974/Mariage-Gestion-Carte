/**
 * Tests de bout en bout sur 7 profils (iPhone SE, iPhone 15, Pixel 7, Galaxy S9+, iPad Mini,
 * iPad Pro paysage, ordinateur 1440). Le serveur testé est le build de PRODUCTION (CSP active)
 * sur une base dédiée ; le worker et Mailpit permettent de vérifier les vrais emails.
 */
import { defineConfig, devices } from '@playwright/test';

export const E2E = {
  PORT: Number(process.env.E2E_PORT ?? 4500),
  DATABASE_URL: process.env.E2E_DATABASE_URL ?? 'postgres://mariage:mariage@localhost:5434/mariage_test',
  MAILPIT: process.env.E2E_MAILPIT ?? 'http://localhost:8025',
  SMTP_PORT: process.env.E2E_SMTP_PORT ?? '1025',
};
const baseURL = `http://localhost:${E2E.PORT}`;

export const serverEnv: Record<string, string> = {
  NODE_ENV: 'production',
  PORT: String(E2E.PORT),
  HOST: '127.0.0.1',
  PUBLIC_URL: baseURL,
  DATABASE_URL: E2E.DATABASE_URL,
  SESSION_SECRET: 'e2e-secret-e2e-secret-e2e-secret-0123456',
  ADMIN_EMAIL: 'maries@mariage.test',
  // mot de passe : mariage-dev-2026
  ADMIN_PASSWORD_HASH:
    '$argon2id$v=19$m=19456,t=2,p=1$5O72idxnErqv9hXyXNqXRA$hV7/GwoNHXVRtMwWYAn2VY7cH5L97qlhU8xpdBNB6oE',
  EMAIL_PROVIDER: 'smtp',
  SMTP_HOST: 'localhost',
  SMTP_PORT: E2E.SMTP_PORT,
  MAIL_FROM: 'Camille & Alex <mariage@mariage.test>',
  WHATSAPP_PROVIDER: 'fake',
  WHATSAPP_APP_SECRET: 'e2e-app-secret',
  WHATSAPP_VERIFY_TOKEN: 'e2e-verify',
  UPLOAD_DIR: './data/e2e-uploads',
  WORKER_SEND_INTERVAL_MS: '300',
  LOG_LEVEL: 'warn',
  // comme derrière Caddy : chaque test se présente avec sa propre IP (voir e2e/fixtures.ts)
  TRUST_PROXY: 'true',
};

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  workers: process.env.CI ? 2 : 3,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'fr-FR',
    timezoneId: 'Indian/Reunion',
  },
  projects: [
    { name: 'iphone-se', use: { ...devices['iPhone SE'] } },
    { name: 'iphone-15', use: { ...devices['iPhone 15'] } },
    { name: 'pixel-7', use: { ...devices['Pixel 7'] } },
    { name: 'galaxy-s9', use: { ...devices['Galaxy S9+'] } },
    { name: 'ipad-mini', use: { ...devices['iPad Mini'] } },
    { name: 'ipad-pro-paysage', use: { ...devices['iPad Pro 11 landscape'] } },
    { name: 'desktop-1440', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    command: 'node dist/start.mjs',
    url: `${baseURL}/api/health`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: serverEnv,
  },
});
