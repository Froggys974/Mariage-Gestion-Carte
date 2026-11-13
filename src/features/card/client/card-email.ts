/**
 * « Recevoir par email » : le navigateur dessine la carte (même image que « Enregistrer la carte ») et
 * l'envoie au serveur avec l'adresse saisie ; le worker l'expédie (image dans l'email + pièce jointe).
 */
import { card as t } from '~/content/fr';
import type { AppContext } from '../../invitation/client/features';
import type { SheetController } from '../../invitation/client/sheets';
import { drawCard, toBlob } from './card-png';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function mount(ctx: AppContext, sheets: SheetController): void {
  const token = ctx.boot.token;
  const scrim = ctx.root.querySelector<HTMLElement>('[data-sheet="card-email"]');
  const form = scrim?.querySelector<HTMLFormElement>('form');
  const ask = scrim?.querySelector<HTMLElement>('[data-card-email-ask]');
  const done = scrim?.querySelector<HTMLElement>('[data-card-email-done]');
  const doneText = scrim?.querySelector<HTMLElement>('[data-card-email-done-text]');
  const error = scrim?.querySelector<HTMLElement>('[data-card-email-error]');
  const input = scrim?.querySelector<HTMLInputElement>('input[name="email"]');
  const submit = scrim?.querySelector<HTMLButtonElement>('[data-card-email-submit]');
  if (!token || !scrim || !form || !ask || !done || !doneText || !error || !input || !submit) return;

  const showError = (text: string) => {
    error.textContent = text;
    error.hidden = false;
    input.setAttribute('aria-invalid', 'true');
    input.focus();
  };

  ctx.root.addEventListener('click', (e) => {
    if (!(e.target as HTMLElement).closest('[data-card-email]')) return;
    ask.hidden = false;
    done.hidden = true;
    error.hidden = true;
    input.removeAttribute('aria-invalid');
    sheets.open('card-email', { focus: 'input[name="email"]' });
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = input.value.trim();
    if (!EMAIL_RE.test(email)) return showError(t.emailInvalid);
    error.hidden = true;
    submit.disabled = true;
    const label = submit.textContent;
    submit.textContent = t.emailSending;
    try {
      const png = await toBlob(await drawCard(ctx.boot.card));
      if (!png) throw new Error('canvas');
      const body = new FormData();
      body.append('email', email);
      body.append('card', png, 'carte.png');
      const res = await fetch(`/api/rsvp/${encodeURIComponent(token)}/card-email`, {
        method: 'POST',
        body,
        credentials: 'same-origin',
      });
      const data = (await res.json().catch(() => ({}))) as { to?: string; error?: string; domain?: string };
      if (res.ok) {
        doneText.textContent = t.emailDone(data.to ?? email);
        ask.hidden = true;
        done.hidden = false;
      } else if (data.error === 'email') showError(t.emailInvalid);
      else if (data.error === 'email_domain') showError(t.emailDomain(data.domain ?? ''));
      else if (data.error === 'too_many') showError(t.emailTooMany);
      else showError(t.emailError);
    } catch {
      showError(t.emailError);
    } finally {
      submit.disabled = false;
      submit.textContent = label;
    }
  });
}
