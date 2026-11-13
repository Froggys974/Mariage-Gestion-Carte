/** Parcours invité : intro, faire-part, réponse, modification sans doublon. */
import { E2E } from '../playwright.config';
import { expect, fillSeat, openSeat, test, waitForMail } from './fixtures';

test.describe('site invité', () => {
  test('1. ouvrir le lien personnel et passer l’intro', async ({ page, invitation, sql }) => {
    await page.goto(`/i/${invitation.token}`);
    const intro = page.locator('[data-intro-el]');
    await expect(intro).toBeVisible();
    await expect(page.getByText('Antré, zot lé byinvni')).toHaveAttribute('lang', 'rcf');
    await page.getByRole('button', { name: 'Entrer' }).click();
    await expect(intro).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Camille & Alex/); // mariage fictif (src/features/wedding/demo.ts)
    await expect(page.getByRole('button', { name: /Ouvrir le faire.part/ })).toBeVisible();
    // le statut passe à « opened » à la première visite
    await expect
      .poll(async () => (await sql`select status from invitation where id = ${invitation.id}`)[0]?.status)
      .toBe('opened');
    // aucun défilement horizontal
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('2. ouvrir le faire-part et enregistrer la carte', async ({ page, invitation }) => {
    await page.goto(`/i/${invitation.token}?intro=0`);
    await page.getByRole('button', { name: /Ouvrir le faire.part/ }).click();
    const seal = page.getByRole('button', { name: 'Ouvrir le faire-part' });
    await expect(seal).toBeVisible();
    await seal.click();
    const save = page.getByRole('button', { name: 'Enregistrer la carte' });
    await expect(save).toBeVisible({ timeout: 10_000 });
    const download = page.waitForEvent('download');
    await save.click();
    const file = await download;
    expect(file.suggestedFilename()).toBe('Faire-part-Camille-Alex.png');
    await expect(page.locator('[data-card-hint]')).toHaveText('Carte enregistrée dans vos téléchargements.');
  });

  test('2 bis. recevoir la carte par email (image dans le message + pièce jointe)', async ({
    page,
    invitation,
  }) => {
    await page.goto(`/i/${invitation.token}?intro=0&scene=1&open=1`);
    const button = page.getByRole('button', { name: 'Recevoir par email' });
    await expect(button).toBeVisible({ timeout: 10_000 });
    await button.click();
    const input = page.locator('[data-sheet="card-email"] input[name="email"]');
    await expect(input).toHaveValue(invitation.email); // préremplie avec l'adresse de l'invitation
    await page.getByRole('button', { name: 'Envoyer la carte' }).click();
    await expect(page.locator('[data-card-email-done-text]')).toContainText(invitation.email, {
      timeout: 15_000,
    });
    const mail = await waitForMail(invitation.email, 30_000);
    expect(mail.subject).toBe('Votre faire‑part · Camille & Alex');
    const search = (await (
      await fetch(`${E2E.MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${invitation.email}"`)}`)
    ).json()) as { messages: Array<{ ID: string }> };
    const full = (await (await fetch(`${E2E.MAILPIT}/api/v1/message/${search.messages[0]!.ID}`)).json()) as {
      Inline: Array<{ FileName: string }>;
      Attachments: Array<{ FileName: string }>;
    };
    expect(full.Inline.map((a) => a.FileName)).toEqual(['Faire-part-Camille-Alex.png']);
    expect(full.Attachments.map((a) => a.FileName)).toEqual(['Faire-part-Camille-Alex.png']);
  });

  test('3. ajouter 2 membres de la famille avec une allergie, puis envoyer', async ({
    page,
    invitation,
    sql,
  }) => {
    await page.goto(`/i/${invitation.token}?intro=0&scene=3`);
    await expect(page.locator('[data-seat-count]')).toContainText('1 / 6 places');
    await openSeat(page, 1);
    await fillSeat(page, 'Léa', invitation.last, 'Allergie aux fruits de mer');
    await openSeat(page, 2);
    await fillSeat(page, 'Noah', invitation.last);
    await expect(page.locator('[data-seat-count]')).toContainText('3 / 6 places');
    await page.locator('[data-rsvp-send]').click();
    await expect(page.locator('[data-rsvp-send]')).toHaveText('Réponse envoyée ✓');
    await expect(page.locator('[data-rsvp-hint] [lang="rcf"]')).toHaveText('Mersi !');
    const rows =
      await sql`select first_name, notes from guest where invitation_id = ${invitation.id} order by position`;
    expect(rows.map((r) => r.first_name)).toEqual(['Marie', 'Léa', 'Noah']);
    expect(rows[1]?.notes).toBe('Allergie aux fruits de mer');
    expect((await sql`select status from invitation where id = ${invitation.id}`)[0]?.status).toBe(
      'submitted',
    );
  });

  test('4. recharger, modifier, renvoyer : aucun doublon', async ({ page, invitation, sql }) => {
    await page.goto(`/i/${invitation.token}?intro=0&scene=3`);
    await openSeat(page, 1);
    await fillSeat(page, 'Léa', invitation.last, 'Fruits de mer');
    await page.locator('[data-rsvp-send]').click();
    await expect(page.locator('[data-rsvp-send]')).toHaveText('Réponse envoyée ✓');
    const before =
      await sql`select id, first_name from guest where invitation_id = ${invitation.id} order by position`;

    await page.reload();
    await expect(page.locator('[data-rsvp-send]')).toHaveText('Réponse envoyée ✓');
    await expect(page.locator('[data-seat-count]')).toContainText('2 / 6 places');
    await openSeat(page, 1);
    await expect(page.locator('[data-seat-form] input[name="first"]')).toHaveValue('Léa');
    await fillSeat(page, 'Léa', invitation.last, 'Fruits de mer et kiwi');
    await expect(page.locator('[data-rsvp-send]')).toHaveText('Mettre à jour notre réponse');
    await expect(page.locator('[data-rsvp-hint]')).toHaveText(
      'Votre nouvelle réponse remplacera la précédente, sans doublon.',
    );
    await page.locator('[data-rsvp-send]').click();
    await expect(page.locator('[data-rsvp-send]')).toHaveText('Réponse envoyée ✓');
    // double envoi : toujours le même nombre de personnes
    await page.locator('[data-rsvp-send]').click();

    const after =
      await sql`select id, first_name, notes from guest where invitation_id = ${invitation.id} order by position`;
    expect(after).toHaveLength(2);
    expect(after.map((r) => r.id)).toEqual(before.map((r) => r.id));
    expect(after[1]?.notes).toBe('Fruits de mer et kiwi');
  });
});
