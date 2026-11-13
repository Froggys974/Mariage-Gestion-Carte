/** Appels à /api/admin/* depuis les îlots : jeton CSRF dans l'en-tête, réponses typées. */
/** En cas d'erreur, `extra` reprend les champs ajoutés par le serveur (ex. { suggestion } pour email_typo). */
export type ApiResult<T> =
  { ok: true; data: T } | { ok: false; status: number; error: string; extra: Record<string, unknown> };

function csrfToken(): string {
  return document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? '';
}

export async function api<T>(method: string, url: string, body?: unknown): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      method,
      credentials: 'same-origin',
      headers: {
        'x-csrf-token': csrfToken(),
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const data = (await res.json().catch(() => ({}))) as T & { error?: string } & Record<string, unknown>;
    if (res.status === 401) {
      location.href = `/admin/login?next=${encodeURIComponent(location.pathname + location.search)}`;
    }
    return res.ok
      ? { ok: true, data }
      : { ok: false, status: res.status, error: data.error ?? 'error', extra: data };
  } catch {
    return { ok: false, status: 0, error: 'offline', extra: {} };
  }
}

/** Recherche sans accents ni casse. */
export function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}
