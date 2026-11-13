/** Fixtures e2e : une invitation neuve par test (aucun test ne dépend d'un autre), accès base et Mailpit. */
import { randomBytes } from 'node:crypto';
import { test as base, expect, type Page } from '@playwright/test';
import postgres from 'postgres';
import { E2E, serverEnv } from '../playwright.config';

export interface TestInvitation {
  id: string;
  token: string;
  first: string;
  last: string;
  email: string;
}

type Sql = ReturnType<typeof postgres>;

export const test = base.extend<{ sql: Sql; invitation: TestInvitation }, object>({
  // un visiteur distinct par test : les limites anti-abus par IP ne se cumulent pas entre tests parallèles
  extraHTTPHeaders: async ({ extraHTTPHeaders }, use) => {
    const ip = `10.${[...randomBytes(3)].join('.')}`;
    await use({ ...extraHTTPHeaders, 'x-forwarded-for': ip });
  },
  // eslint-disable-next-line no-empty-pattern
  sql: async ({}, use) => {
    const sql = postgres(serverEnv.DATABASE_URL!, { onnotice: () => {}, max: 2 });
    await use(sql);
    await sql.end();
  },
  invitation: async ({ sql }, use, info) => {
    const token = randomBytes(16).toString('base64url');
    const tag = `${info.project.name}-${randomBytes(3).toString('hex')}`;
    const last = `Test${tag.replace(/[^a-z0-9]/gi, '')}`;
    const email = `${tag}@e2e.test`.toLowerCase();
    const [row] = await sql<{ id: string }[]>`
      insert into invitation (token, display_name, contact_first_name, contact_last_name, email, status, host_agreement)
      values (${token}, ${'Famille ' + last}, 'Marie', ${last}, ${email}, 'sent', 'invitee') returning id`;
    await use({ id: row!.id, token, first: 'Marie', last, email });
  },
});

export { expect };

/** Ouvre la feuille d'une chaise par la liste accessible (clavier), comme un lecteur d'écran. */
export async function openSeat(page: Page, i: number): Promise<void> {
  await page.focus(`[data-seat-btn="${i}"]`);
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-sheet="seat"]')).toBeVisible();
}

export async function fillSeat(page: Page, first: string, last: string, note = ''): Promise<void> {
  await page.fill('[data-seat-form] input[name="first"]', first);
  await page.fill('[data-seat-form] input[name="last"]', last);
  await page.fill('[data-seat-form] textarea[name="note"]', note);
  await page.click('[data-seat-form] .sheet__submit');
  await expect(page.locator('[data-sheet="seat"]')).toBeHidden();
}

/** Attend un email dans Mailpit pour ce destinataire. */
export async function waitForMail(
  to: string,
  timeoutMs = 20_000,
): Promise<{ subject: string; text: string }> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await fetch(`${E2E.MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`);
    if (res.ok) {
      const data = (await res.json()) as { messages?: Array<{ ID: string; Subject: string }> };
      const m = data.messages?.[0];
      if (m) {
        const full = (await (await fetch(`${E2E.MAILPIT}/api/v1/message/${m.ID}`)).json()) as {
          Text: string;
        };
        return { subject: m.Subject, text: full.Text };
      }
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`aucun email reçu pour ${to}`);
}

export const ADMIN = { email: 'maries@mariage.test', password: 'mariage-dev-2026' };
