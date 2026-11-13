/** Espace des mariés : connexion, création, copie du lien, plan de table. */
import { randomBytes, randomInt } from 'node:crypto';
import type { Locator, Page } from '@playwright/test';
import { ADMIN, expect, test } from './fixtures';

async function login(page: Page): Promise<void> {
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin\/login/);
  await page.fill('input[name="email"]', ADMIN.email);
  await page.fill('input[name="password"]', ADMIN.password);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/admin$/);
}

/**
 * Glisser-déposer au pointeur (souris ; le code gère aussi le tactile via Pointer Events).
 * Si la cible est hors de l'écran (liste longue sur mobile), on approche le bord pour déclencher
 * le défilement automatique, comme le ferait un utilisateur.
 */
async function dragTo(page: Page, source: Locator, target: Locator): Promise<void> {
  const MARGIN = 90;
  const a = (await source.boundingBox())!;
  const x0 = a.x + a.width / 2;
  await page.mouse.move(x0, a.y + a.height / 2);
  await page.mouse.down();
  const vh = page.viewportSize()!.height;
  for (let i = 0; i < 300; i++) {
    const b = (await target.boundingBox())!;
    if (b.y >= MARGIN && b.y + b.height <= vh - MARGIN) {
      // quitter d'abord la zone de bord (le défilement s'arrête), puis viser la cible à sa position finale
      await page.mouse.move(x0, vh / 2);
      const c = (await target.boundingBox())!;
      await page.mouse.move(c.x + c.width / 2, c.y + c.height / 2, { steps: 10 });
      await page.mouse.up();
      return;
    }
    await page.mouse.move(x0, b.y < MARGIN ? 4 : vh - 4, { steps: 2 });
    await page.waitForTimeout(30);
  }
  throw new Error('cible du glisser-déposer jamais atteinte');
}

test('6. admin : se connecter, créer une invitation, copier le lien, placer une personne, enregistrer le plan', async ({
  page,
  context,
  sql,
  browserName,
}) => {
  if (browserName === 'chromium') await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await login(page);

  // créer une invitation
  const last = `Admin${randomBytes(3).toString('hex')}`;
  // numéro propre à ce test : les 7 profils tournent en parallèle et un contact ne peut être invité qu'une fois
  const phone = `0692 ${[0, 0, 0].map(() => String(randomInt(10, 100))).join(' ')}`;
  await page.getByPlaceholder('Prénom', { exact: true }).fill('Jeanne');
  await page.getByPlaceholder('Nom', { exact: true }).fill(last);
  await page.getByPlaceholder('Téléphone', { exact: true }).fill(phone);
  // sans email et sans API WhatsApp : WhatsApp (wa.me) s'ouvre avec le message et le lien personnel
  const popup = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Envoyer le faire-part' }).click();
  const wa = await popup;
  await expect.poll(() => wa.url(), { timeout: 15_000 }).toMatch(/wa\.me|whatsapp\.com/);
  await wa.close();
  await expect(
    page
      .getByRole('status')
      .filter({ hasText: `Jeanne ${last}` })
      .first(),
  ).toBeVisible();
  const row = page.locator('.inv__item', { hasText: `Jeanne ${last}` });
  await expect(row).toBeVisible();
  await expect(row).toContainText(phone);

  // copier le lien
  await row.getByRole('button', { name: 'Lien' }).click();
  await expect(row.getByRole('button', { name: 'Copié' })).toBeVisible();
  if (browserName === 'chromium') {
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toMatch(/\/i\/[A-Za-z0-9_-]{22}$/);
  }
  await expect
    .poll(
      async () =>
        (
          await sql`select count(*)::int as n from send_log s join invitation i on i.id = s.invitation_id where i.contact_last_name = ${last} and s.channel = 'lien'`
        )[0]?.n,
    )
    .toBe(2); // wa.me à la création + lien copié

  // plan de table : une table ronde, puis Camille (une des mariés) sur une chaise
  await page.getByRole('link', { name: 'Plan de table' }).click();
  await expect(page).toHaveURL(/tab=plan/);
  // chaque profil travaille sur sa propre version du plan (tests en parallèle)
  page.once('dialog', (d) => void d.accept(`E2E ${last}`));
  await page.getByRole('button', { name: 'Nouvelle version' }).click();
  await expect(page).toHaveURL(/plan=[0-9a-f-]{36}/);
  await expect(page.locator('.plan__version-select select')).toContainText(`E2E ${last}`);
  await page.getByRole('button', { name: '+ Table ronde' }).click();
  const person = page.locator('.plan__person', { hasText: 'Camille' });
  await person.evaluate((el) => el.scrollIntoView({ block: 'start' }));
  const seat = page.locator('[data-seat]').first();
  await seat.evaluate((el) => el.scrollIntoView({ block: 'center', inline: 'center' }));
  await person.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await dragTo(page, person, seat);
  await expect(seat).toHaveText(/^C\s*Camille/);
  await expect(page.locator('.plan__status')).toHaveText('Modifications non enregistrées');
  await page.getByRole('button', { name: 'Enregistrer le plan' }).click();
  await expect(page.locator('.plan__status')).toHaveText(/Enregistré à \d{2}:\d{2}/);

  await page.reload();
  await expect(page.locator('[data-seat]').first()).toHaveText(/^C\s*Camille/);
});
