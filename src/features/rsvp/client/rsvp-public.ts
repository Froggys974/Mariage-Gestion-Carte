/** Page /rsvp : recherche par nom puis vérification du code à 6 chiffres. */

interface Texts {
  missing: string;
  badCode: string;
  tooMany: string;
}

export function mount(): void {
  const search = document.querySelector<HTMLFormElement>('[data-rp-search]');
  const verify = document.querySelector<HTMLFormElement>('[data-rp-verify]');
  if (!search || !verify) return;
  const texts = JSON.parse(document.getElementById('rp-texts')?.textContent ?? '{}') as Texts;
  const err = search.querySelector<HTMLElement>('[data-rp-error]')!;
  const codeErr = verify.querySelector<HTMLElement>('[data-rp-code-error]')!;
  let challengeId = '';

  const post = async (url: string, body: unknown) => {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { status: res.status, data: (await res.json().catch(() => ({}))) as Record<string, string> };
  };

  search.addEventListener('submit', async (e) => {
    e.preventDefault();
    const first = (search.elements.namedItem('first') as HTMLInputElement).value.trim();
    const last = (search.elements.namedItem('last') as HTMLInputElement).value.trim();
    if (!first || !last) {
      err.textContent = texts.missing;
      err.hidden = false;
      return;
    }
    err.hidden = true;
    const r = await post('/api/rsvp-public/search', { first, last }).catch(() => null);
    if (!r || r.status === 429) {
      err.textContent = texts.tooMany;
      err.hidden = false;
      return;
    }
    challengeId = r.data.challengeId ?? '';
    search.hidden = true;
    verify.hidden = false;
    verify.querySelector<HTMLInputElement>('input[name="code"]')?.focus();
  });

  verify.addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = (verify.elements.namedItem('code') as HTMLInputElement).value.replace(/\D/g, '');
    const r = await post('/api/rsvp-public/verify', { challengeId, code }).catch(() => null);
    if (r?.data.url) {
      location.href = r.data.url;
      return;
    }
    codeErr.textContent = r?.status === 429 ? texts.tooMany : texts.badCode;
    codeErr.hidden = false;
  });

  verify.querySelector('[data-rp-restart]')?.addEventListener('click', () => {
    verify.hidden = true;
    search.hidden = false;
    codeErr.hidden = true;
    (verify.elements.namedItem('code') as HTMLInputElement).value = '';
  });
}
