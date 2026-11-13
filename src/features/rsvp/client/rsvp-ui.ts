/**
 * Scène Table côté interface : chaises, étiquettes, compteur, bouton d'envoi, texte d'aide,
 * feuille d'une chaise, déclin et liste équivalente pour les lecteurs d'écran.
 * La synchronisation serveur est fournie par `sync` (draft-sync.ts).
 */
import { sheet as st, table as t, type Rich } from '~/content/fr';
import type { BootSeat, GuestBoot } from '../../invitation/boot';
import type { AppContext } from '../../invitation/client/features';
import type { SheetController } from '../../invitation/client/sheets';
import * as table3d from './table3d';

export type Seat = BootSeat;
export type Seats = Array<Seat | null>;

export interface RsvpFlags {
  sent: boolean;
  declined: boolean;
  changed: boolean;
  closed: boolean;
}

export interface ServerState {
  seats: Seats;
  sent: boolean;
  declined: boolean;
  changed?: boolean;
}

export type SyncResult =
  | { ok: true; state?: ServerState }
  | { ok: false; reason: 'offline' | 'conflict' | 'closed' | 'error'; state?: ServerState };

export interface RsvpSync {
  /** brouillon modifié : enregistrement automatique */
  draftChanged(seats: Seats): void;
  submit(seats: Seats): Promise<SyncResult>;
  decline(): Promise<SyncResult>;
  /** chaises de départ (brouillon local plus récent que le serveur) */
  readonly initialSeats?: Seats;
  readonly restoredLocal?: boolean;
  /** résultat d'un envoi parti plus tard, au retour du réseau */
  onLateResult?(fn: (item: { kind: string }, r: SyncResult) => void): void;
}

export const RSVP_UI = {
  SEND_BURST: 30,
  SEND_SPREAD: 180,
  SEAT_BURST: 16,
  SEAT_SPREAD: 90,
  SHEET_PARAM_DELAY_MS: 200,
} as const;

// ---------------------------------------------------------------------------
//  Partie pure (testée)
// ---------------------------------------------------------------------------

export function initials(s: Seat): string {
  return (((s.first.trim() || ' ')[0] ?? ' ') + ((s.last.trim() || ' ')[0] ?? ' ')).trim().toUpperCase();
}

export function fullName(s: Seat): string {
  return `${s.first.trim()} ${s.last.trim()}`.trim();
}

export function seatLabel(s: Seat, isHost: boolean, agreement: GuestBoot['hostAgreement']): string {
  return fullName(s) + (isHost ? t.hostSuffix[agreement] : '');
}

export function countFilled(seats: Seats): number {
  return seats.filter(Boolean).length;
}

export interface ButtonState {
  label: string;
  hint: Rich | string;
  disabled: boolean;
  showDecline: boolean;
}

/** Libellé du bouton et texte d'aide (prototype + déclin + date limite). */
export function buttonState(f: RsvpFlags, deadlineLabel: string): ButtonState {
  if (f.closed) {
    return { label: t.closedLabel, hint: t.hintClosed(deadlineLabel), disabled: true, showDecline: false };
  }
  if (f.declined) {
    return {
      label: t.send,
      hint: f.changed ? t.hintChanged : t.hintDeclined(deadlineLabel),
      disabled: false,
      showDecline: false,
    };
  }
  if (!f.sent) return { label: t.send, hint: t.hintBefore, disabled: false, showDecline: true };
  if (f.changed) return { label: t.update, hint: t.hintChanged, disabled: false, showDecline: true };
  return { label: t.sent, hint: t.hintSent(deadlineLabel), disabled: false, showDecline: true };
}

/** Une saisie de chaise est valide si elle a au moins un prénom ou un nom. */
export function validSeat(first: string, last: string): boolean {
  return first.trim().length > 0 || last.trim().length > 0;
}

// ---------------------------------------------------------------------------
//  Partie DOM
// ---------------------------------------------------------------------------

function renderRich(el: HTMLElement, r: Rich | string): void {
  el.replaceChildren();
  const segs = typeof r === 'string' ? [r] : r;
  for (const s of segs) {
    if (typeof s === 'string') el.append(s);
    else {
      const span = document.createElement('span');
      span.lang = 'rcf';
      span.textContent = s.rcf;
      el.append(span);
    }
  }
}

export function mount(ctx: AppContext, sheets: SheetController, sync: RsvpSync): void {
  const { boot, root } = ctx;
  const box = root.querySelector<HTMLElement>('[data-table]');
  if (!box) return;
  const seats: Seats = boot.seats.map((s) => (s ? { ...s } : null));
  const flags: RsvpFlags = {
    sent: boot.sent,
    declined: boot.declined,
    changed: boot.changed,
    closed: boot.closed,
  };
  const max = boot.maxSeats;
  let pulled: number | null = null;
  let sheetSeat: number | null = null;
  let pendingOpen = 0;
  let busy = false;

  const seat3d = Array.from(box.querySelectorAll<HTMLElement>('[data-seat3d]'));
  const labels = Array.from(box.querySelectorAll<HTMLElement>('[data-label]'));
  const a11y = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-seat-btn]'));
  const count = root.querySelector<HTMLElement>('[data-seat-count]');
  const send = root.querySelector<HTMLButtonElement>('[data-rsvp-send]');
  const hint = root.querySelector<HTMLElement>('[data-rsvp-hint]');
  const declineBtn = root.querySelector<HTMLButtonElement>('[data-rsvp-decline]');
  const status = root.querySelector<HTMLElement>('[data-rsvp-status]');
  const form = root.querySelector<HTMLFormElement>('[data-seat-form]');
  const seatScrim = root.querySelector<HTMLElement>('[data-sheet="seat"]');
  const sheetTitle = seatScrim?.querySelector<HTMLElement>('[data-sheet-title]');
  const removeBtn = root.querySelector<HTMLButtonElement>('[data-seat-remove]');
  const seatError = root.querySelector<HTMLElement>('[data-seat-error]');

  const setStatus = (msg: string) => {
    if (!status) return;
    status.textContent = msg;
    status.classList.toggle('sr-only', msg === '');
  };

  const render = () => {
    seats.forEach((s, i) => {
      const locked = i >= max;
      const lb = labels[i];
      const s3 = seat3d[i];
      const state = s ? 'is-filled' : locked ? 'is-locked' : 'is-open';
      for (const el of [lb, s3]) {
        if (!el) continue;
        el.classList.toggle('is-filled', state === 'is-filled');
        el.classList.toggle('is-open', state === 'is-open');
        el.classList.toggle('is-locked', state === 'is-locked');
      }
      s3?.classList.toggle('is-pulled', pulled === i);
      if (lb) {
        const ini = lb.querySelector<HTMLElement>('[data-initials]');
        const name = lb.querySelector<HTMLElement>('[data-name]');
        if (ini) ini.textContent = s ? initials(s) : '';
        if (name) name.textContent = s ? seatLabel(s, i === 0, boot.hostAgreement) : '';
      }
      const btn = a11y[i];
      if (btn) {
        btn.textContent = s
          ? t.seatEdit(i + 1, fullName(s))
          : locked
            ? t.seatLocked(i + 1)
            : t.seatAdd(i + 1);
        btn.disabled = locked || flags.closed || !boot.token;
      }
    });
    box.classList.toggle('is-readonly', flags.closed);
    if (count) count.textContent = t.count(countFilled(seats), max);
    const b = buttonState(flags, boot.deadlineLabel);
    if (send && !busy) {
      send.textContent = b.label;
      send.disabled = b.disabled;
    }
    if (hint) renderRich(hint, b.hint);
    if (declineBtn) declineBtn.hidden = !b.showDecline;
  };

  const table = table3d.init(box, {
    mode: () => ctx.mode,
    isPaused: () => sheetSeat !== null || pulled !== null,
    onTap: (i) => tap(i),
  });
  ctx.onFrame((dt, now, p) => table.tick(dt, now, p));

  const burstAt = (el: Element | null | undefined, n: number, spread: number) => {
    if (!el) return;
    const r = el.getBoundingClientRect();
    ctx.fx?.burst(r.left + r.width / 2, r.top + r.height / 2, n, spread);
  };

  const field = (name: string) =>
    form?.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement | null;

  function openSheet(i: number) {
    if (!form) return;
    const s = seats[i];
    sheetSeat = i;
    const first = field('first');
    const last = field('last');
    const note = field('note');
    if (first) first.value = s?.first ?? '';
    if (last) last.value = s?.last ?? '';
    if (note) note.value = s?.note ?? '';
    if (sheetTitle) sheetTitle.textContent = s ? st.titleEdit : st.titleNew;
    if (removeBtn) removeBtn.hidden = !(s && i !== 0);
    if (seatError) seatError.hidden = true;
    sheets.open('seat', { focus: 'input[name="first"]' });
  }

  function tap(i: number) {
    if (!boot.token) {
      root.querySelector<HTMLElement>('[data-open-lost]')?.click();
      return;
    }
    if (flags.closed || i >= max || sheets.isOpen()) return;
    table.bringToFront(i);
    pulled = i;
    render();
    clearTimeout(pendingOpen);
    const delay = ctx.mode === 'reduced' ? 0 : table3d.TABLE.OPEN_SHEET_DELAY_MS;
    pendingOpen = window.setTimeout(() => openSheet(i), delay);
  }

  sheets.onClose('seat', () => {
    sheetSeat = null;
    pulled = null;
    render();
  });

  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const i = sheetSeat;
    if (i === null) return;
    const first = field('first')?.value ?? '';
    const last = field('last')?.value ?? '';
    const note = field('note')?.value ?? '';
    if (!validSeat(first, last)) {
      if (seatError) seatError.hidden = false;
      field('first')?.focus();
      return;
    }
    const prev = seats[i];
    seats[i] = {
      ...(prev?.id ? { id: prev.id } : {}),
      first: first.trim(),
      last: last.trim(),
      note: note.trim(),
    };
    flags.changed = true;
    sync.draftChanged(seats);
    sheets.close('seat');
    window.requestAnimationFrame(() => burstAt(labels[i], RSVP_UI.SEAT_BURST, RSVP_UI.SEAT_SPREAD));
  });
  removeBtn?.addEventListener('click', () => {
    const i = sheetSeat;
    if (i === null || i === 0) return;
    seats[i] = null;
    flags.changed = true;
    sync.draftChanged(seats);
    sheets.close('seat');
  });

  const applyServer = (s?: ServerState) => {
    if (!s) return;
    s.seats.forEach((x, i) => (seats[i] = x ? { ...x } : null));
    flags.sent = s.sent;
    flags.declined = s.declined;
    flags.changed = s.changed ?? false;
  };

  const handleFailure = (r: Extract<SyncResult, { ok: false }>) => {
    if (r.reason === 'offline') setStatus(t.offlineQueued);
    else if (r.reason === 'conflict') {
      applyServer(r.state);
      setStatus(t.conflict);
    } else if (r.reason === 'closed') {
      flags.closed = true;
      setStatus('');
    } else setStatus(t.sendError);
  };

  send?.addEventListener('click', async (e) => {
    if (busy || flags.closed) return;
    const x = e.clientX;
    const y = e.clientY;
    if (flags.sent && !flags.changed) {
      if (x) ctx.fx?.burst(x, y, RSVP_UI.SEND_BURST, RSVP_UI.SEND_SPREAD);
      return;
    }
    busy = true;
    send.disabled = true;
    send.textContent = t.sending;
    setStatus('');
    const r = await sync.submit(seats);
    busy = false;
    if (r.ok) {
      applyServer(r.state);
      flags.sent = true;
      flags.declined = false;
      flags.changed = false;
      if (x) ctx.fx?.burst(x, y, RSVP_UI.SEND_BURST, RSVP_UI.SEND_SPREAD);
      else burstAt(send, RSVP_UI.SEND_BURST, RSVP_UI.SEND_SPREAD);
    } else handleFailure(r);
    render();
  });

  declineBtn?.addEventListener('click', () => sheets.open('decline', { focus: '[data-decline-confirm]' }));
  root.querySelector('[data-decline-confirm]')?.addEventListener('click', async () => {
    const r = await sync.decline();
    sheets.close('decline');
    if (r.ok) {
      applyServer(r.state);
      flags.declined = true;
      flags.sent = false;
      flags.changed = false;
      setStatus('');
    } else handleFailure(r);
    render();
  });

  sync.onLateResult?.((item, r) => {
    if (r.ok) {
      applyServer(r.state);
      flags.sent = item.kind === 'submit';
      flags.declined = item.kind === 'decline';
      flags.changed = false;
      setStatus('');
    } else handleFailure(r);
    render();
  });

  a11y.forEach((btn, i) => btn.addEventListener('click', () => tap(i)));

  const sheetParam = ctx.params.get('sheet');
  if (sheetParam !== null && boot.token) {
    const n = Number(sheetParam);
    if (Number.isInteger(n) && n >= 0 && n < max) {
      window.setTimeout(() => {
        pulled = n;
        render();
        openSheet(n);
      }, RSVP_UI.SHEET_PARAM_DELAY_MS);
    }
  }
  render();
}
