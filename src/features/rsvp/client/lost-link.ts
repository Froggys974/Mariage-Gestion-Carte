/**
 * « Lien perdu ? » : l'invité saisit l'email ou le téléphone de l'invitation.
 * La réponse affichée est TOUJOURS la même (aucune fuite d'information sur la liste des invités).
 */
import { lost } from '~/content/fr';
import type { SheetController } from '../../invitation/client/sheets';

export const LOST = { MIN_LENGTH: 5, ENDPOINT: '/api/lost-link' } as const;

export function init(root: HTMLElement, sheets: SheetController): { destroy(): void } {
  const scrim = root.querySelector<HTMLElement>('[data-sheet="lost"]');
  const form = scrim?.querySelector<HTMLFormElement>('form');
  const ask = scrim?.querySelector<HTMLElement>('[data-lost-ask]');
  const done = scrim?.querySelector<HTMLElement>('[data-lost-done]');
  const error = scrim?.querySelector<HTMLElement>('[data-lost-error]');
  const input = scrim?.querySelector<HTMLInputElement>('input[name="contact"]');
  if (!scrim || !form || !ask || !done || !input || !error) return { destroy() {} };

  const reset = () => {
    ask.hidden = false;
    done.hidden = true;
    error.hidden = true;
  };
  const openLost = (e: Event) => {
    if (!(e.target as HTMLElement).closest('[data-open-lost]')) return;
    reset();
    sheets.open('lost', { focus: 'input[name="contact"]' });
  };
  root.addEventListener('click', openLost);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const value = input.value.trim();
    if (value.length < LOST.MIN_LENGTH) {
      error.textContent = lost.invalid;
      error.hidden = false;
      input.setAttribute('aria-invalid', 'true');
      input.focus();
      return;
    }
    input.removeAttribute('aria-invalid');
    error.hidden = true;
    try {
      await fetch(LOST.ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ contact: value }),
      });
    } catch {
      /* même message : rien ne doit trahir l'existence du contact */
    }
    ask.hidden = true;
    done.hidden = false;
    scrim.querySelector<HTMLElement>('.sheet')?.focus();
  });

  if (new URLSearchParams(location.search).get('lost') === '1') {
    reset();
    sheets.open('lost', { focus: 'input[name="contact"]' });
  }

  return {
    destroy() {
      root.removeEventListener('click', openLost);
    },
  };
}
