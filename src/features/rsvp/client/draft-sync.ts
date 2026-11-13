/**
 * Synchronisation de la réponse :
 * - brouillon enregistré côté serveur 1 s après la dernière modification, et dans le localStorage ;
 * - file d'attente persistante : sans réseau, les envois repartent automatiquement au retour de la connexion ;
 * - le brouillon se retrouve sur un autre appareil grâce au lien (serveur).
 */
import type { RsvpSync, Seats, ServerState, SyncResult } from './rsvp-ui';

export const SYNC = {
  DEBOUNCE_MS: 1000,
  RETRY_MS: [2000, 5000, 10_000, 30_000, 60_000],
  KEY_DRAFT: 'rcgn:draft:',
  KEY_QUEUE: 'rcgn:queue:',
} as const;

export type QueueItem =
  | { kind: 'draft'; seats: Seats }
  | { kind: 'submit'; seats: Seats; expectedUpdatedAt: string | null }
  | { kind: 'decline'; expectedUpdatedAt: string | null };

/** Fusion de la file : un nouveau brouillon remplace l'ancien ; un envoi ou un déclin remplace tout. */
export function enqueue(queue: QueueItem[], item: QueueItem): QueueItem[] {
  if (item.kind !== 'draft') return [item];
  return [...queue.filter((q) => q.kind !== 'draft'), item];
}

export function retryDelay(attempt: number): number {
  return SYNC.RETRY_MS[Math.min(attempt, SYNC.RETRY_MS.length - 1)] ?? 60_000;
}

interface LocalDraft {
  seats: Seats;
  at: number;
}

/** Brouillon local à reprendre s'il est plus récent que celui du serveur. */
export function pickInitial(
  server: Seats,
  serverDraftAt: string | null,
  local: LocalDraft | null,
): { seats: Seats; fromLocal: boolean } {
  if (!local) return { seats: server, fromLocal: false };
  const serverAt = serverDraftAt ? Date.parse(serverDraftAt) : 0;
  const same = JSON.stringify(local.seats) === JSON.stringify(server);
  if (local.at > serverAt && !same) return { seats: local.seats, fromLocal: true };
  return { seats: server, fromLocal: false };
}

const storage = {
  get<T>(key: string): T | null {
    try {
      const v = localStorage.getItem(key);
      return v ? (JSON.parse(v) as T) : null;
    } catch {
      return null;
    }
  },
  set(key: string, value: unknown): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* stockage indisponible (navigation privée) : le serveur reste la référence */
    }
  },
  remove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      /* idem */
    }
  },
};

type Outcome =
  | { ok: true; state?: ServerState & { updatedAt?: string } }
  | {
      ok: false;
      reason: 'offline' | 'conflict' | 'closed' | 'error';
      state?: ServerState & { updatedAt?: string };
    };

export interface DraftSync extends RsvpSync {
  readonly initialSeats: Seats;
  readonly restoredLocal: boolean;
  /** résultat d'un envoi parti plus tard (après une coupure réseau) */
  onLateResult(fn: (item: QueueItem, r: SyncResult) => void): void;
  destroy(): void;
}

export function create(opts: {
  token: string;
  updatedAt: string | null;
  draftUpdatedAt: string | null;
  seats: Seats;
  fetchImpl?: typeof fetch;
}): DraftSync {
  const doFetch = opts.fetchImpl ?? fetch.bind(window);
  const kDraft = SYNC.KEY_DRAFT + opts.token;
  const kQueue = SYNC.KEY_QUEUE + opts.token;
  let version = opts.updatedAt;
  let queue: QueueItem[] = storage.get<QueueItem[]>(kQueue) ?? [];
  let debounce = 0;
  let retry = 0;
  let attempt = 0;
  let flushing: Promise<void> | null = null;
  const late: Array<(item: QueueItem, r: SyncResult) => void> = [];
  const waiters = new Map<QueueItem, (r: Outcome) => void>();

  const initial = pickInitial(opts.seats, opts.draftUpdatedAt, storage.get<LocalDraft>(kDraft));

  const persistQueue = () => (queue.length ? storage.set(kQueue, queue) : storage.remove(kQueue));

  async function send(item: QueueItem): Promise<Outcome> {
    const base = `/api/rsvp/${encodeURIComponent(opts.token)}`;
    const req =
      item.kind === 'draft'
        ? { url: `${base}/draft`, method: 'PUT', body: { seats: item.seats } }
        : item.kind === 'submit'
          ? {
              url: `${base}/submit`,
              method: 'POST',
              body: { seats: item.seats, expectedUpdatedAt: item.expectedUpdatedAt },
            }
          : { url: `${base}/decline`, method: 'POST', body: { expectedUpdatedAt: item.expectedUpdatedAt } };
    let res: Response;
    try {
      res = await doFetch(req.url, {
        method: req.method,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(req.body),
        credentials: 'same-origin',
      });
    } catch {
      return { ok: false, reason: 'offline' };
    }
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      state?: ServerState & { updatedAt?: string };
    } & Partial<ServerState & { updatedAt: string }>;
    if (res.ok)
      return {
        ok: true,
        state: item.kind === 'draft' ? undefined : (data as ServerState & { updatedAt?: string }),
      };
    if (res.status === 409) return { ok: false, reason: 'conflict', state: data.state };
    if (res.status === 403) return { ok: false, reason: 'closed' };
    if (res.status >= 500 || res.status === 0) return { ok: false, reason: 'offline' };
    return { ok: false, reason: 'error' };
  }

  function schedule(ms: number) {
    clearTimeout(retry);
    retry = window.setTimeout(() => void flush(), ms);
  }

  function flush(): Promise<void> {
    if (flushing) return flushing;
    flushing = (async () => {
      while (queue.length) {
        if (typeof navigator !== 'undefined' && navigator.onLine === false) break;
        const item = queue[0]!;
        const r = await send(item);
        if (!r.ok && r.reason === 'offline') {
          waiters.get(item)?.(r);
          waiters.delete(item);
          schedule(retryDelay(attempt++));
          break;
        }
        attempt = 0;
        queue = queue.filter((q) => q !== item);
        persistQueue();
        if (r.state?.updatedAt) version = r.state.updatedAt;
        if (r.ok && item.kind !== 'draft') storage.remove(kDraft);
        const waiter = waiters.get(item);
        if (waiter) {
          waiter(r);
          waiters.delete(item);
        } else if (item.kind !== 'draft') late.forEach((fn) => fn(item, r));
      }
    })().finally(() => {
      flushing = null;
    });
    return flushing;
  }

  function push(item: QueueItem): Promise<Outcome> {
    queue = enqueue(queue, item);
    persistQueue();
    const p = new Promise<Outcome>((resolve) => waiters.set(item, resolve));
    void flush();
    return p;
  }

  const onOnline = () => {
    attempt = 0;
    void flush();
  };
  window.addEventListener('online', onOnline);
  if (queue.length) void flush();
  if (initial.fromLocal) {
    debounce = window.setTimeout(() => void push({ kind: 'draft', seats: initial.seats }), SYNC.DEBOUNCE_MS);
  }

  return {
    initialSeats: initial.seats,
    restoredLocal: initial.fromLocal,
    draftChanged(seats) {
      const copy = seats.map((s) => (s ? { ...s } : null));
      storage.set(kDraft, { seats: copy, at: Date.now() } satisfies LocalDraft);
      clearTimeout(debounce);
      debounce = window.setTimeout(() => void push({ kind: 'draft', seats: copy }), SYNC.DEBOUNCE_MS);
    },
    async submit(seats) {
      clearTimeout(debounce);
      const copy = seats.map((s) => (s ? { ...s } : null));
      return push({ kind: 'submit', seats: copy, expectedUpdatedAt: version });
    },
    async decline() {
      clearTimeout(debounce);
      return push({ kind: 'decline', expectedUpdatedAt: version });
    },
    onLateResult(fn) {
      late.push(fn);
    },
    destroy() {
      clearTimeout(debounce);
      clearTimeout(retry);
      window.removeEventListener('online', onOnline);
    },
  };
}
