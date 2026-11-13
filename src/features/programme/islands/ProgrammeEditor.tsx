/** Onglet « Programme » : les moments de la journée affichés sur le site invité (scène « Le programme »). */
import { useState } from 'preact/hooks';
import { admin } from '~/content/fr';
import { api } from '~/features/admin/islands/api';
import { emptyItem, moveItem, PROGRAMME, type ProgrammeItem } from '../programme';

const t = admin.programme;

interface Row extends ProgrammeItem {
  key: number;
}

let nextKey = 0;
const toRows = (items: ProgrammeItem[]): Row[] => items.map((i) => ({ ...i, key: nextKey++ }));
const isFilled = (r: Row) => r.time.trim() !== '' && r.title.trim() !== '';

export default function ProgrammeEditor({ initial }: { initial: ProgrammeItem[] }) {
  const [rows, setRows] = useState<Row[]>(() => toRows(initial));
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState(false);

  const change = (key: number, field: keyof ProgrammeItem) => (e: Event) => {
    const value = (e.target as HTMLInputElement).value;
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, [field]: value } : r)));
  };
  const move = (i: number, dir: -1 | 1) => setRows((rs) => moveItem(rs, i, dir));
  const remove = (key: number) => setRows((rs) => rs.filter((r) => r.key !== key));
  const add = () => setRows((rs) => [...rs, { ...emptyItem(), key: nextKey++ }]);

  const save = async (e: Event) => {
    e.preventDefault();
    setChecked(true);
    if (rows.length === 0 || !rows.every(isFilled)) {
      setMsg({ text: t.invalid, ok: false });
      return;
    }
    setBusy(true);
    setMsg({ text: t.saving, ok: true });
    const items = rows.map(({ time, title, place, note }) => ({ time, title, place, note }));
    const r = await api<{ items: ProgrammeItem[] }>('PUT', '/api/admin/programme', { items });
    if (r.ok) {
      setRows(toRows(r.data.items));
      setChecked(false);
      setMsg({ text: t.saved, ok: true });
    } else setMsg({ text: r.status === 400 ? t.invalid : admin.list.error, ok: false });
    setBusy(false);
  };

  return (
    <div class="prog-editor">
      <form class="a-card" onSubmit={save} noValidate>
        <h2 class="a-card__title">{t.title}</h2>
        <p class="a-hint prog-editor__help">{t.help}</p>
        <ol class="prog-editor__list">
          {rows.map((r, i) => (
            <li key={r.key} class="prog-editor__item">
              <fieldset class="prog-editor__set">
                <legend class="prog-editor__legend">{t.item(i + 1)}</legend>
                <div class="prog-editor__two">
                  <label class="a-field">
                    {t.time}
                    <input
                      class="a-input"
                      value={r.time}
                      onInput={change(r.key, 'time')}
                      maxLength={PROGRAMME.TIME_MAX}
                      placeholder={t.timePlaceholder}
                      aria-invalid={checked && !r.time.trim() ? 'true' : undefined}
                    />
                  </label>
                  <label class="a-field">
                    {t.what}
                    <input
                      class="a-input"
                      value={r.title}
                      onInput={change(r.key, 'title')}
                      maxLength={PROGRAMME.TITLE_MAX}
                      placeholder={t.whatPlaceholder}
                      aria-invalid={checked && !r.title.trim() ? 'true' : undefined}
                    />
                  </label>
                </div>
                <label class="a-field">
                  {t.place}
                  <input
                    class="a-input"
                    value={r.place}
                    onInput={change(r.key, 'place')}
                    maxLength={PROGRAMME.PLACE_MAX}
                    placeholder={t.placePlaceholder}
                  />
                </label>
                <label class="a-field">
                  {t.note}
                  <input
                    class="a-input"
                    value={r.note}
                    onInput={change(r.key, 'note')}
                    maxLength={PROGRAMME.NOTE_MAX}
                    placeholder={t.notePlaceholder}
                  />
                </label>
                <div class="a-toolbar">
                  <button
                    class="a-btn a-btn--outline a-btn--small"
                    type="button"
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                  >
                    ↑ {t.up}
                  </button>
                  <button
                    class="a-btn a-btn--outline a-btn--small"
                    type="button"
                    onClick={() => move(i, 1)}
                    disabled={i === rows.length - 1}
                  >
                    ↓ {t.down}
                  </button>
                  <span class="a-spacer" />
                  <button
                    class="a-btn a-btn--danger a-btn--small"
                    type="button"
                    onClick={() => remove(r.key)}
                    disabled={rows.length === 1}
                  >
                    {t.remove}
                  </button>
                </div>
              </fieldset>
            </li>
          ))}
        </ol>
        <div class="a-toolbar">
          <button
            class="a-btn a-btn--outline"
            type="button"
            onClick={add}
            disabled={rows.length >= PROGRAMME.MAX_ITEMS}
          >
            + {t.add}
          </button>
          {rows.length >= PROGRAMME.MAX_ITEMS && <span class="a-hint">{t.max(PROGRAMME.MAX_ITEMS)}</span>}
        </div>
        <div class="a-toolbar">
          <button class="a-btn a-btn--primary" type="submit" disabled={busy}>
            {t.save}
          </button>
          {msg && (
            <span class={msg.ok ? 'a-hint' : 'a-error'} role="status">
              {msg.text}
            </span>
          )}
        </div>
      </form>

      <aside class="prog-preview" aria-label={t.preview}>
        <p class="prog-preview__label">{t.preview}</p>
        <ol class="prog-preview__list">
          {rows.map((r) => (
            <li key={r.key} class="prog-preview__item">
              <span class="prog-preview__time">{r.time || '—'}</span>
              <span>
                <span class="prog-preview__what">{r.title || '…'}</span>
                {r.place && <span class="prog-preview__place">{r.place}</span>}
                {r.note && <span class="prog-preview__note">{r.note}</span>}
              </span>
            </li>
          ))}
        </ol>
      </aside>
    </div>
  );
}
