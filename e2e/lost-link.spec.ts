/** « Lien perdu ? » : même réponse pour tous, et le vrai lien arrive par email. */
import { expect, test, waitForMail } from './fixtures';

test('5. lien perdu : le lien personnel est renvoyé par email', async ({ page, invitation }) => {
  await page.goto('/?intro=0&scene=5');
  await page.getByRole('button', { name: /Lien perdu/ }).click();
  const sheet = page.locator('[data-sheet="lost"]');
  await expect(sheet).toBeVisible();
  await expect(sheet.locator('input[name="contact"]')).toBeFocused();
  await sheet.locator('input[name="contact"]').fill(invitation.email.toUpperCase());
  await sheet.getByRole('button', { name: 'Recevoir mon lien' }).click();
  await expect(sheet.getByText(/Si ce contact figure sur la liste des invités/)).toBeVisible();

  const mail = await waitForMail(invitation.email);
  expect(mail.subject).toContain('Votre lien personnel');
  expect(mail.text).toContain(`/i/${invitation.token}`);
});

test('5 bis. lien perdu : un contact inconnu reçoit exactement la même réponse', async ({ page }) => {
  await page.goto('/?intro=0&scene=5&lost=1');
  const sheet = page.locator('[data-sheet="lost"]');
  await sheet.locator('input[name="contact"]').fill('inconnu-total@e2e.test');
  await sheet.getByRole('button', { name: 'Recevoir mon lien' }).click();
  await expect(sheet.getByText(/Si ce contact figure sur la liste des invités/)).toBeVisible();
});
