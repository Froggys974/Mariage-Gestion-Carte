/**
 * Cadrage de la photo (onglet « Modifier la carte ») : forme, déplacement au doigt / à la souris / au clavier,
 * zoom. La photo d'origine n'est pas modifiée ; le cadrage est enregistré à part (PUT /api/admin/card/photo-frame).
 */
import { useRef, useState } from 'preact/hooks';
import { admin } from '~/content/fr';
import { api } from '~/features/admin/islands/api';
import type { EditorData } from '../card.admin';
import {
  dragFrame,
  FRAME,
  frameStyle,
  isLoose,
  minZoom,
  PHOTO_SHAPES,
  type PhotoFrame,
  type PhotoShape,
} from '../photo-frame';

const t = admin.card;
const KEY_STEP = 6;

export function PhotoFrameEditor({
  photo,
  frame,
  onChange,
  onSaved,
}: {
  photo: NonNullable<EditorData['card']['photo']>;
  frame: PhotoFrame;
  onChange: (f: PhotoFrame) => void;
  onSaved: (d: EditorData) => void;
}) {
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const shapeRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; x: number; y: number; start: PhotoFrame } | null>(null);

  const change = (f: PhotoFrame) => {
    setMsg(null);
    onChange(f);
  };
  const min = minZoom(frame.shape, photo.width, photo.height);
  // une autre forme n'a pas le même zoom minimum
  const changeShape = (shape: PhotoShape) =>
    change({ ...frame, shape, zoom: Math.max(frame.zoom, minZoom(shape, photo.width, photo.height)) });

  const move = (start: PhotoFrame, dx: number, dy: number) => {
    const el = shapeRef.current;
    if (!el) return start;
    return dragFrame(
      start,
      dx,
      dy,
      { w: photo.width, h: photo.height },
      { w: el.clientWidth, h: el.clientHeight },
    );
  };

  const onDown = (e: PointerEvent) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, start: frame };
  };
  const onMove = (e: PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    change(move(d.start, e.clientX - d.x, e.clientY - d.y));
  };
  const onUp = (e: PointerEvent) => {
    if (drag.current?.id === e.pointerId) drag.current = null;
  };
  const onKey = (e: KeyboardEvent) => {
    const step = e.shiftKey ? KEY_STEP * 5 : KEY_STEP;
    const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[
      e.key
    ] as [number, number] | undefined;
    if (!d) return;
    e.preventDefault();
    change(move(frame, d[0], d[1]));
  };

  const save = async () => {
    setBusy(true);
    const r = await api<EditorData>('PUT', '/api/admin/card/photo-frame', frame);
    setBusy(false);
    if (r.ok) {
      onSaved(r.data);
      setMsg({ text: t.frameSaved, ok: true });
    } else setMsg({ text: admin.list.error, ok: false });
  };

  return (
    <section class="a-card frame-editor" aria-labelledby="frame-title">
      <h2 class="a-card__title" id="frame-title">
        {t.frameTitle}
      </h2>
      <p class="a-hint frame-editor__help">{t.frameHelp}</p>

      <fieldset class="frame-editor__shapes">
        <legend class="a-field">{t.shape}</legend>
        {PHOTO_SHAPES.map((s) => (
          <label key={s} class={`frame-editor__shape${frame.shape === s ? ' is-on' : ''}`}>
            <input
              type="radio"
              name="photo-shape"
              value={s}
              checked={frame.shape === s}
              onChange={() => changeShape(s)}
            />
            <span class={`frame-editor__icon frame-editor__icon--${s}`} aria-hidden="true" />
            {t.shapes[s]}
          </label>
        ))}
      </fieldset>

      <div class="frame-editor__zone">
        <div
          ref={shapeRef}
          class={`photo-shape photo-shape--${frame.shape}${isLoose(frame) ? ' photo-shape--loose' : ''} frame-editor__stage`}
          style={frameStyle(frame, photo.width, photo.height)}
          role="img"
          aria-label={t.frameStage}
          tabIndex={0}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onKeyDown={onKey}
        >
          <picture>
            <source type="image/avif" srcset={photo.avif} sizes="640px" />
            <source type="image/webp" srcset={photo.webp} sizes="640px" />
            <img src={photo.fallback} alt="" draggable={false} />
          </picture>
        </div>
      </div>

      <label class="a-field frame-editor__zoom">
        {t.zoom}
        <input
          type="range"
          min={min}
          max={FRAME.ZOOM_MAX}
          step={0.01}
          value={frame.zoom}
          onInput={(e) => change({ ...frame, zoom: Number((e.target as HTMLInputElement).value) })}
        />
      </label>

      <div class="a-toolbar">
        <button class="a-btn a-btn--primary" type="button" onClick={save} disabled={busy}>
          {t.saveFrame}
        </button>
        <button
          class="a-btn a-btn--outline"
          type="button"
          onClick={() => change({ ...frame, x: 50, y: 50, zoom: 1 })}
        >
          {t.recenter}
        </button>
        {msg && (
          <span class={msg.ok ? 'a-hint' : 'a-error'} role="status">
            {msg.text}
          </span>
        )}
      </div>
    </section>
  );
}
