/**
 * Onglet « Modifier la carte » : champs du prototype, aperçu en direct (noms en Pinyon Script),
 * photo, et réglages des réponses (date limite, lien public /rsvp, effacement des données de santé).
 */
import { useRef, useState } from 'preact/hooks';
import { admin, card as cardTexts } from '~/content/fr';
import { api } from '~/features/admin/islands/api';
import { toDateInput } from '~/lib/dates';
import type { EditorData } from '../card.admin';
import { uploadNamesPng } from '../client/names-png';
import { frameStyle, isLoose } from '../photo-frame';
import { PhotoFrameEditor } from './PhotoFrameEditor';

const t = admin.card;
function csrf(): string {
  return document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? '';
}

export default function CardEditor({ initial }: { initial: EditorData }) {
  const [data, setData] = useState(initial);
  const [f, setF] = useState({ ...initial.card });
  const [frame, setFrame] = useState(initial.card.frame);
  const [s, setS] = useState({
    rsvpDeadline: toDateInput(new Date(initial.settings.rsvpDeadline)),
    publicRsvpEnabled: initial.settings.publicRsvpEnabled,
    purgeAt: toDateInput(new Date(initial.settings.purgeAt)),
  });
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [settingsMsg, setSettingsMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = (k: keyof typeof f) => (e: Event) => setF({ ...f, [k]: (e.target as HTMLInputElement).value });

  const save = async (e: Event) => {
    e.preventDefault();
    setBusy(true);
    setMsg({ text: t.saving, ok: true });
    const r = await api<EditorData>('PUT', '/api/admin/card', {
      names: f.names,
      date: f.date,
      place: f.place,
      ceremony: f.ceremony,
      reception: f.reception,
      message: f.message,
      expectedUpdatedAt: data.card.updatedAt,
    });
    if (r.ok) {
      if (r.data.card.names !== data.card.names || !initial.card.names) {
        await uploadNamesPng(r.data.card.names);
      }
      setData(r.data);
      setMsg({ text: t.saved, ok: true });
    } else setMsg({ text: r.status === 409 ? admin.list.conflict : admin.list.error, ok: false });
    setBusy(false);
  };

  const upload = async (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    setMsg({ text: t.uploading, ok: true });
    const fd = new FormData();
    fd.append('photo', file);
    const res = await fetch('/api/admin/card/photo', {
      method: 'POST',
      headers: { 'x-csrf-token': csrf() },
      body: fd,
    }).catch(() => null);
    if (res?.ok) {
      const d = (await res.json()) as EditorData;
      setData(d);
      setFrame(d.card.frame);
      setF((x) => ({ ...x, updatedAt: d.card.updatedAt }));
      setMsg({ text: t.saved, ok: true });
    } else setMsg({ text: t.photoError, ok: false });
    if (fileRef.current) fileRef.current.value = '';
  };

  const removePhoto = async () => {
    const r = await api<EditorData>('DELETE', '/api/admin/card/photo');
    if (r.ok) setData(r.data);
  };

  const saveSettings = async (e: Event) => {
    e.preventDefault();
    const r = await api<EditorData>('PATCH', '/api/admin/card', s);
    setSettingsMsg(r.ok ? t.settingsSaved : admin.list.error);
    if (r.ok) setData(r.data);
  };

  const photo = data.card.photo;
  const [msg1 = '', ...msgRest] = f.message.split(/\r?\n/);

  return (
    <div class="card-editor">
      <div class="card-editor__forms">
        <form class="a-card" onSubmit={save} noValidate>
          <h2 class="a-card__title">{t.title}</h2>
          <label class="a-field">
            {t.names}
            <input class="a-input" value={f.names} onInput={set('names')} maxLength={80} />
          </label>
          <label class="a-field">
            {t.date}
            <input class="a-input" value={f.date} onInput={set('date')} maxLength={40} />
          </label>
          <label class="a-field">
            {t.place}
            <textarea class="a-input" rows={2} value={f.place} onInput={set('place')} maxLength={200} />
          </label>
          <div class="card-editor__two">
            <label class="a-field">
              {t.ceremony}
              <input class="a-input" value={f.ceremony} onInput={set('ceremony')} maxLength={20} />
            </label>
            <label class="a-field">
              {t.reception}
              <input class="a-input" value={f.reception} onInput={set('reception')} maxLength={20} />
            </label>
          </div>
          <label class="a-field">
            {t.message}
            <textarea class="a-input" rows={3} value={f.message} onInput={set('message')} maxLength={400} />
            <span class="a-hint card-editor__help">{t.messageHelp}</span>
          </label>
          <label class="a-field">
            {t.photo}
            <input ref={fileRef} class="card-editor__file" type="file" accept="image/*" onChange={upload} />
          </label>
          {photo && (
            <button class="a-btn a-btn--danger" type="button" onClick={removePhoto}>
              {t.removePhoto}
            </button>
          )}
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

        {photo && (
          <PhotoFrameEditor
            photo={photo}
            frame={frame}
            onChange={setFrame}
            onSaved={(d) => {
              setData(d);
              setFrame(d.card.frame);
            }}
          />
        )}

        <form class="a-card" onSubmit={saveSettings} noValidate>
          <h2 class="a-card__title">{t.settingsTitle}</h2>
          <label class="a-field">
            {t.deadline}
            <input
              class="a-input"
              type="date"
              value={s.rsvpDeadline}
              onInput={(e) => setS({ ...s, rsvpDeadline: (e.target as HTMLInputElement).value })}
            />
          </label>
          <label class="a-check">
            <input
              type="checkbox"
              checked={s.publicRsvpEnabled}
              onChange={(e) => setS({ ...s, publicRsvpEnabled: (e.target as HTMLInputElement).checked })}
            />
            {t.publicRsvp}
          </label>
          <label class="a-field">
            {t.purgeAt}
            <input
              class="a-input"
              type="date"
              value={s.purgeAt}
              onInput={(e) => setS({ ...s, purgeAt: (e.target as HTMLInputElement).value })}
            />
          </label>
          <div class="a-toolbar">
            <button class="a-btn a-btn--outline" type="submit">
              {admin.list.save}
            </button>
            {settingsMsg && (
              <span class="a-hint" role="status">
                {settingsMsg}
              </span>
            )}
          </div>
        </form>
      </div>

      <div class="card-preview-wrap">
        <div class="card-preview" aria-label={t.preview}>
          <div class="card-preview__frame" />
          <div class="card-preview__date">{f.date}</div>
          <div class="card-preview__names">{f.names}</div>
          <div class="card-preview__rule" />
          <div class="card-preview__place">
            {f.place.split(/\r?\n/).map((l, k) => (
              <span key={k}>
                {k > 0 && <br />}
                {l}
              </span>
            ))}
          </div>
          <div class="card-preview__times">
            <span>
              {cardTexts.ceremony} {f.ceremony}
            </span>
            <span class="card-preview__sep">·</span>
            <span>
              {cardTexts.reception} {f.reception}
            </span>
          </div>
          <div class={`card-preview__photo${photo ? '' : ' card-preview__photo--empty'}`}>
            {photo ? (
              <div
                class={`photo-shape photo-shape--${frame.shape}${isLoose(frame) ? ' photo-shape--loose' : ''}`}
                style={frameStyle(frame, photo.width, photo.height)}
              >
                <picture>
                  <source type="image/avif" srcset={photo.avif} sizes="280px" />
                  <source type="image/webp" srcset={photo.webp} sizes="280px" />
                  <img src={photo.fallback} alt="" />
                </picture>
              </div>
            ) : (
              <span>{cardTexts.photoPlaceholder}</span>
            )}
          </div>
          <div class="card-preview__msg">
            <span lang="rcf">{msg1}</span>
            {msgRest.length > 0 && (
              <>
                <br />
                <span class="card-preview__msg2">{msgRest.join(' ')}</span>
              </>
            )}
          </div>
        </div>
        <div class="card-preview__hint">{t.preview}</div>
      </div>
    </div>
  );
}
