/**
 * Onglet « Invitations » : nouvel envoi, recherche et filtres, sélection et envoi groupé,
 * copie du lien, renvoi (email, WhatsApp, wa.me), fiche, historique des envois, import / export CSV.
 */
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import {
  admin,
  channel as channelLabels,
  purpose as purposeLabels,
  sendStatus,
  status as statusLabels,
  whatsapp,
} from '~/content/fr';
import { classifySendError } from '~/features/messaging/send-errors';
import type { WeddingLabels } from '~/features/wedding/wedding';
import type { AdminInvitation, Kpis as KpiData, SendInfo } from '../invitations.service';
import { api, fold } from './api';
import { CsvImport } from './CsvImport';
import { KPIS_EVENT } from './Kpis';

const t = admin.list;
const fa = admin.failures;
const STATUSES = ['not_sent', 'sent', 'opened', 'started', 'submitted', 'declined'] as const;
const COPIED_MS = 1600;
const TOAST_MS = 3200;

interface Props {
  initial: AdminInvitation[];
  kpis: KpiData;
  publicHost: string;
  /** infos du mariage (texte du message WhatsApp sans API) */
  wedding: WeddingLabels;
}

type Sort = AdminInvitation[];

/** Cause lisible d'un envoi en échec. */
const reasonOf = (s: SendInfo) => fa.reasons[classifySendError(s.channel, s.error)];

/** Message d'erreur d'une saisie refusée par le serveur. */
function inputError(r: { error: string; extra: Record<string, unknown> }, fallback: string): string {
  const issues = Array.isArray(r.extra.issues) ? (r.extra.issues as Array<{ message?: string }>) : [];
  const has = (m: string) => r.error === m || issues.some((i) => i.message === m);
  if (r.error === 'email_domain') return t.emailDomain(String(r.extra.domain ?? ''));
  if (has('phone')) return t.phoneInvalid;
  if (has('email')) return t.emailInvalid;
  if (has('contact')) return t.missing;
  return fallback;
}

/** « Vouliez-vous dire … ? » avec deux choix : corriger, ou garder l'adresse saisie. */
function TypoChoice({
  suggestion,
  onFix,
  onKeep,
}: {
  suggestion: string;
  onFix: () => void;
  onKeep: () => void;
}) {
  return (
    <div class="a-typo" role="alert">
      <span class="a-error">{t.emailTypo(suggestion)}</span>
      <button class="a-btn a-btn--primary a-btn--small" type="button" onClick={onFix}>
        {t.emailTypoFix(suggestion)}
      </button>
      <button class="a-btn a-btn--outline a-btn--small" type="button" onClick={onKeep}>
        {t.emailTypoKeep}
      </button>
    </div>
  );
}

function waLink(w: WeddingLabels, inv: AdminInvitation): string {
  const text = encodeURIComponent(whatsapp.manual(w, inv.first, inv.link));
  return inv.phone
    ? `https://wa.me/${inv.phone.replace(/^\+/, '')}?text=${text}`
    : `https://wa.me/?text=${text}`;
}

export default function InvitationsApp({ initial, kpis: initialKpis, publicHost, wedding }: Props) {
  const [list, setList] = useState<Sort>(initial);
  const [kpis, setKpis] = useState(initialKpis);
  useEffect(() => {
    window.dispatchEvent(new CustomEvent(KPIS_EVENT, { detail: kpis }));
  }, [kpis]);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [channelFilter, setChannelFilter] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openId, setOpenId] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const toastTimer = useRef(0);

  const say = (msg: string) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(''), TOAST_MS);
  };

  const reload = async () => {
    const r = await api<{ invitations: AdminInvitation[]; kpis: KpiData }>('GET', '/api/admin/invitations');
    if (r.ok) {
      setList(r.data.invitations);
      setKpis(r.data.kpis);
    }
  };

  // Les statuts d'envoi évoluent (file d'attente, webhooks) : rafraîchissement discret.
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') void reload();
    }, 15_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.a-row__actions')) setMenuId(null);
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  const visible = useMemo(() => {
    const q = fold(query.trim());
    return list.filter((i) => {
      if (statusFilter === 'send_failed') {
        if (i.lastSend?.status !== 'failed') return false;
      } else if (statusFilter && i.status !== statusFilter) return false;
      if (
        channelFilter === 'none'
          ? i.lastSend !== null
          : channelFilter && i.lastSend?.channel !== channelFilter
      ) {
        return false;
      }
      if (!q) return true;
      return fold(
        `${i.first} ${i.last} ${i.displayName} ${i.email ?? ''} ${i.phone ?? ''} ${i.phoneLabel ?? ''}`,
      ).includes(q);
    });
  }, [list, query, statusFilter, channelFilter]);

  const failures = useMemo(() => list.filter((i) => i.lastSend?.status === 'failed'), [list]);
  const openFiche = (id: string) => {
    setQuery('');
    setStatusFilter('');
    setChannelFilter('');
    setOpenId(id);
    window.requestAnimationFrame(() =>
      document
        .querySelector(`[data-invitation="${id}"]`)
        ?.scrollIntoView({ block: 'center', behavior: 'smooth' }),
    );
  };

  const replace = (inv: AdminInvitation | null | undefined) => {
    if (inv) setList((l) => l.map((x) => (x.id === inv.id ? inv : x)));
  };

  const send = async (inv: AdminInvitation, channel: 'email' | 'whatsapp' | 'lien' | 'wa_me') => {
    setMenuId(null);
    const r = await api<{ invitation: AdminInvitation }>('POST', `/api/admin/invitations/${inv.id}/send`, {
      channel,
    });
    if (r.ok) {
      replace(r.data.invitation);
      if (channel === 'email' || channel === 'whatsapp') say(t.queued);
      void reload();
    } else say(r.error === 'no_contact' ? t.noChannel : t.error);
  };

  const copy = async (inv: AdminInvitation) => {
    try {
      await navigator.clipboard.writeText(inv.link);
    } catch {
      window.prompt(t.copyTitle, inv.link);
    }
    setCopied(inv.id);
    window.setTimeout(() => setCopied((c) => (c === inv.id ? null : c)), COPIED_MS);
    await send(inv, 'lien');
  };

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const allVisibleSelected = visible.length > 0 && visible.every((i) => selected.has(i.id));

  const bulkSend = async (channel: 'email' | 'whatsapp') => {
    const ids = [...selected];
    const r = await api<{ queued: number; skipped: number }>('POST', '/api/admin/send/bulk', {
      ids,
      channel,
    });
    if (r.ok) {
      say(t.bulkQueued(r.data.queued) + (r.data.skipped ? ` ${t.bulkSkipped(r.data.skipped)}` : ''));
      setSelected(new Set());
      void reload();
    } else say(t.error);
  };
  const bulkDelete = async () => {
    const ids = [...selected];
    if (!window.confirm(t.confirmDelete(ids.length))) return;
    const r = await api<{ kpis: KpiData }>('POST', '/api/admin/invitations/delete', { ids });
    if (r.ok) {
      setList((l) => l.filter((i) => !selected.has(i.id)));
      setKpis(r.data.kpis);
      setSelected(new Set());
    } else say(t.error);
  };

  return (
    <div class="inv">
      <NewInvitation
        onCreated={(inv, k, msg) => {
          setList((l) => [inv, ...l]);
          setKpis(k);
          say(msg);
        }}
      />

      {failures.length > 0 && (
        <section class="a-alert" aria-labelledby="send-failures-title">
          <h2 class="a-alert__title" id="send-failures-title">
            <span aria-hidden="true">⚠ </span>
            {fa.title(failures.length)}
          </h2>
          <p class="a-alert__help">{fa.help}</p>
          <ul class="a-alert__list">
            {failures.map((inv) => (
              <li key={inv.id} class="a-alert__item">
                <span class="a-alert__who">
                  {inv.first} {inv.last}
                </span>
                <span class="a-alert__why">
                  {channelLabels[inv.lastSend!.channel]} · {reasonOf(inv.lastSend!)}
                </span>
                <button
                  class="a-btn a-btn--outline a-btn--small"
                  type="button"
                  onClick={() => openFiche(inv.id)}
                >
                  {fa.open}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div class="a-toolbar" role="search">
        <input
          class="a-input inv__search"
          type="search"
          placeholder={t.search}
          aria-label={t.search}
          value={query}
          onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
        />
        <select
          class="a-input inv__filter"
          aria-label={admin.list.cols.status}
          value={statusFilter}
          onChange={(e) => setStatusFilter((e.target as HTMLSelectElement).value)}
        >
          <option value="">{t.filterAll}</option>
          {STATUSES.map((s) => (
            <option value={s} key={s}>
              {statusLabels[s]}
            </option>
          ))}
          <option value="send_failed">{t.filterFailed}</option>
        </select>
        <select
          class="a-input inv__filter"
          aria-label={t.lastChannel}
          value={channelFilter}
          onChange={(e) => setChannelFilter((e.target as HTMLSelectElement).value)}
        >
          <option value="">{t.filterChannelAll}</option>
          <option value="email">{channelLabels.email}</option>
          <option value="whatsapp">{channelLabels.whatsapp}</option>
          <option value="lien">{channelLabels.lien}</option>
          <option value="none">{t.notSent}</option>
        </select>
        <div class="a-spacer" />
        <button class="a-btn a-btn--outline" type="button" onClick={() => setImportOpen(true)}>
          {t.importCsv}
        </button>
        <a class="a-btn a-btn--outline" href="/api/admin/export/invitations.csv" download>
          {t.exportCsv}
        </a>
      </div>

      {selected.size > 0 && (
        <div class="a-toolbar inv__bulk" role="region" aria-label={t.selected(selected.size)}>
          <span class="a-chip">{t.selected(selected.size)}</span>
          <button class="a-btn a-btn--outline" type="button" onClick={() => bulkSend('email')}>
            {t.bulkEmail}
          </button>
          <button class="a-btn a-btn--outline" type="button" onClick={() => bulkSend('whatsapp')}>
            {t.bulkWhatsapp}
          </button>
          <button class="a-btn a-btn--danger" type="button" onClick={bulkDelete}>
            {t.bulkDelete}
          </button>
        </div>
      )}

      <div class="a-list a-list--select">
        <div class="a-list__head">
          <input
            type="checkbox"
            aria-label={t.selectAll}
            checked={allVisibleSelected}
            onChange={() => setSelected(allVisibleSelected ? new Set() : new Set(visible.map((i) => i.id)))}
          />
          <div>{t.cols.guest}</div>
          <div>{t.cols.contact}</div>
          <div>{t.cols.status}</div>
          <div>{t.cols.seats}</div>
          <div />
        </div>
        {visible.length === 0 && <div class="a-empty">{t.empty}</div>}
        {visible.map((inv) => (
          <div key={inv.id} class="inv__item" data-invitation={inv.id}>
            <div class="a-row">
              <input
                type="checkbox"
                aria-label={`${inv.first} ${inv.last}`}
                checked={selected.has(inv.id)}
                onChange={() => toggle(inv.id)}
              />
              <div class="a-row__who">
                <button
                  class="a-row__name"
                  type="button"
                  aria-expanded={openId === inv.id}
                  onClick={() => setOpenId(openId === inv.id ? null : inv.id)}
                >
                  {inv.first} {inv.last}
                </button>
                <span class="a-row__sent">
                  {inv.sentLabel}
                  {inv.lastSend && ` · ${channelLabels[inv.lastSend.channel]} · `}
                  {inv.lastSend && (
                    <span class={inv.lastSend.status === 'failed' ? 'a-error' : undefined}>
                      {sendStatus[inv.lastSend.status]}
                    </span>
                  )}
                </span>
                <span class="a-row__link">
                  {publicHost}/i/{inv.token}
                </span>
              </div>
              <div class="a-row__contact">
                <span>{inv.email || '—'}</span>
                <span>{inv.phoneLabel || '—'}</span>
              </div>
              <div>
                <span class={`a-badge a-badge--${inv.status}`}>{statusLabels[inv.status]}</span>
              </div>
              <div class="a-row__seats">{inv.seats || '—'}</div>
              <div class="a-row__actions">
                <button class="a-row__copy" type="button" title={t.copyTitle} onClick={() => copy(inv)}>
                  {copied === inv.id ? t.copied : t.copy}
                </button>
                <button
                  class="a-row__cycle"
                  type="button"
                  title={t.resendTitle}
                  aria-label={t.resendTitle}
                  aria-haspopup="menu"
                  aria-expanded={menuId === inv.id}
                  onClick={() => setMenuId(menuId === inv.id ? null : inv.id)}
                >
                  ↻
                </button>
                {menuId === inv.id && (
                  <div class="a-menu" role="menu">
                    <button
                      role="menuitem"
                      type="button"
                      disabled={!inv.email}
                      onClick={() => send(inv, 'email')}
                    >
                      {t.resendEmail}
                    </button>
                    <button
                      role="menuitem"
                      type="button"
                      disabled={!inv.phone}
                      onClick={() => send(inv, 'whatsapp')}
                    >
                      {t.resendWhatsapp}
                    </button>
                    <a
                      role="menuitem"
                      href={waLink(wedding, inv)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => void send(inv, 'wa_me')}
                    >
                      {t.resendManual}
                    </a>
                  </div>
                )}
              </div>
            </div>
            {inv.notes.length > 0 && (
              <div class="a-row__note">
                {t.notes}
                {inv.notes.map((n) => `${n.name} — ${n.note}`).join(' · ')}
              </div>
            )}
            {openId === inv.id && (
              <EditPanel
                inv={inv}
                onSaved={(x) => {
                  replace(x);
                  say(t.saved);
                }}
                onConflict={() => {
                  say(t.conflict);
                  void reload();
                }}
                onDeleted={() => {
                  setList((l) => l.filter((i) => i.id !== inv.id));
                  setOpenId(null);
                  void reload();
                }}
              />
            )}
          </div>
        ))}
      </div>
      <div class="a-footnote">{t.footer}</div>

      {importOpen && (
        <CsvImport
          onClose={() => setImportOpen(false)}
          onImported={(msg) => {
            say(msg);
            void reload();
          }}
        />
      )}
      {toast && (
        <div class="a-toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}

function NewInvitation({
  onCreated,
}: {
  onCreated: (inv: AdminInvitation, k: KpiData, msg: string) => void;
}) {
  const [f, setF] = useState({ first: '', last: '', email: '', phone: '' });
  const [hint, setHint] = useState<string>(t.hint);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [typo, setTypo] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: Event) => {
    setTypo(null);
    setF({ ...f, [k]: (e.target as HTMLInputElement).value });
  };

  const submit = (e: Event) => {
    e.preventDefault();
    void create(f, false);
  };

  const create = async (fields: typeof f, confirmEmail: boolean) => {
    if (!fields.first.trim() || !fields.last.trim() || (!fields.email.trim() && !fields.phone.trim())) {
      setHint(t.missing);
      setError(true);
      return;
    }
    setBusy(true);
    setTypo(null);
    const r = await api<{ invitation: AdminInvitation; kpis: KpiData; channel: 'email' | 'whatsapp' | null }>(
      'POST',
      '/api/admin/invitations',
      { ...fields, send: true, confirmEmail },
    );
    setBusy(false);
    if (r.ok) {
      const name = `${r.data.invitation.first} ${r.data.invitation.last}`;
      const msg = r.data.channel ? t.createdAndQueued(name, channelLabels[r.data.channel]) : t.created(name);
      onCreated(r.data.invitation, r.data.kpis, msg);
      setF({ first: '', last: '', email: '', phone: '' });
      setHint(msg);
      setError(false);
    } else if (r.error === 'email_typo') {
      setError(true);
      setHint('');
      setTypo(String(r.extra.suggestion ?? ''));
    } else {
      setError(true);
      setHint(
        r.error === 'duplicate' ? `${t.error} (${fields.email || fields.phone})` : inputError(r, t.missing),
      );
    }
  };

  return (
    <form class="a-card" onSubmit={submit} noValidate>
      <h2 class="a-card__title">{t.newTitle}</h2>
      <div class="a-grid-fields">
        <input
          class="a-input"
          placeholder={t.first}
          aria-label={t.first}
          autocomplete="off"
          value={f.first}
          onInput={set('first')}
        />
        <input
          class="a-input"
          placeholder={t.last}
          aria-label={t.last}
          autocomplete="off"
          value={f.last}
          onInput={set('last')}
        />
        <input
          class="a-input"
          type="email"
          placeholder={t.email}
          aria-label={t.email}
          autocomplete="off"
          value={f.email}
          onInput={set('email')}
        />
        <input
          class="a-input"
          type="tel"
          placeholder={t.phone}
          aria-label={t.phone}
          autocomplete="off"
          value={f.phone}
          onInput={set('phone')}
        />
      </div>
      <div class="a-toolbar">
        <button class="a-btn a-btn--primary" type="submit" disabled={busy}>
          {t.send}
        </button>
        <div class={error ? 'a-error' : 'a-hint'} role="status">
          {hint}
        </div>
      </div>
      {typo && (
        <TypoChoice
          suggestion={typo}
          onFix={() => {
            const fixed = { ...f, email: typo };
            setF(fixed);
            void create(fixed, false);
          }}
          onKeep={() => void create(f, true)}
        />
      )}
    </form>
  );
}

function EditPanel({
  inv,
  onSaved,
  onConflict,
  onDeleted,
}: {
  inv: AdminInvitation;
  onSaved: (x: AdminInvitation) => void;
  onConflict: () => void;
  onDeleted: () => void;
}) {
  const [f, setF] = useState({
    first: inv.first,
    last: inv.last,
    email: inv.email ?? '',
    phone: inv.phoneLabel ?? '',
    displayName: inv.displayName,
    maxSeats: String(inv.maxSeats),
    agreement: inv.agreement,
  });
  const [err, setErr] = useState('');
  const [typo, setTypo] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: Event) => {
    setTypo(null);
    setF({ ...f, [k]: (e.target as HTMLInputElement).value });
  };

  const save = (e: Event) => {
    e.preventDefault();
    void persist(f, false);
  };

  const persist = async (fields: typeof f, confirmEmail: boolean) => {
    setTypo(null);
    const r = await api<{ invitation: AdminInvitation }>('PATCH', `/api/admin/invitations/${inv.id}`, {
      first: fields.first,
      last: fields.last,
      email: fields.email.trim() || null,
      phone: fields.phone.trim() || null,
      displayName: fields.displayName,
      maxSeats: Number(fields.maxSeats),
      agreement: fields.agreement,
      confirmEmail,
      expectedUpdatedAt: inv.updatedAt,
    });
    if (r.ok) {
      setErr('');
      onSaved(r.data.invitation);
    } else if (r.status === 409) onConflict();
    else if (r.error === 'email_typo') {
      setErr('');
      setTypo(String(r.extra.suggestion ?? ''));
    } else setErr(inputError(r, t.error));
  };
  const remove = async () => {
    if (!window.confirm(t.confirmDelete(1))) return;
    const r = await api('DELETE', `/api/admin/invitations/${inv.id}`);
    if (r.ok) onDeleted();
  };

  return (
    <form class="a-row__extra" onSubmit={save} noValidate>
      <div class="a-grid-fields">
        <label class="a-field">
          {t.first}
          <input class="a-input" value={f.first} onInput={set('first')} />
        </label>
        <label class="a-field">
          {t.last}
          <input class="a-input" value={f.last} onInput={set('last')} />
        </label>
        <label class="a-field">
          {t.email}
          <input class="a-input" type="email" value={f.email} onInput={set('email')} />
        </label>
        <label class="a-field">
          {t.phone}
          <input class="a-input" type="tel" value={f.phone} onInput={set('phone')} />
        </label>
        <label class="a-field">
          {t.displayName}
          <input class="a-input" value={f.displayName} onInput={set('displayName')} />
        </label>
        <label class="a-field">
          {t.maxSeats}
          <select class="a-input" value={f.maxSeats} onChange={set('maxSeats')}>
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <option value={n} key={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label class="a-field">
          {t.agreement}
          <select class="a-input" value={f.agreement} onChange={set('agreement')}>
            <option value="invite">{t.agreementInvite}</option>
            <option value="invitee">{t.agreementInvitee}</option>
          </select>
        </label>
      </div>
      {err && <p class="a-error">{err}</p>}
      {typo && (
        <TypoChoice
          suggestion={typo}
          onFix={() => {
            const fixed = { ...f, email: typo };
            setF(fixed);
            void persist(fixed, false);
          }}
          onKeep={() => void persist(f, true)}
        />
      )}
      <div class="a-toolbar">
        <button class="a-btn a-btn--primary" type="submit">
          {t.save}
        </button>
        <div class="a-spacer" />
        <button class="a-btn a-btn--danger" type="button" onClick={remove}>
          {t.delete}
        </button>
      </div>
      <div class="a-field">{t.history}</div>
      {inv.history.length === 0 ? (
        <p class="a-hint">{t.noHistory}</p>
      ) : (
        <ul class="a-history">
          {inv.history.map((h) => (
            <li key={h.id}>
              <time dateTime={h.at}>{h.atLabel}</time>
              <span>{channelLabels[h.channel]}</span>
              <span>{purposeLabels[h.purpose]}</span>
              <span class={h.status === 'failed' ? 'a-error' : ''}>{sendStatus[h.status]}</span>
              {h.status === 'failed' && <span class="a-error">{reasonOf(h)}</span>}
              {h.error && (
                <span class="a-hint">
                  {fa.detail}
                  {h.error}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
