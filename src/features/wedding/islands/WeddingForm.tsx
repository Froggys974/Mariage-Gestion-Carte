/**
 * Informations du mariage :
 * - mode « setup » : assistant d'installation en 5 étapes (premier lancement, base vide) ;
 * - mode « edit » : onglet « Mariage », tout sur une page.
 */
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { admin } from '~/content/fr';
import { api } from '~/features/admin/islands/api';
import { uploadNamesPng } from '~/features/card/client/names-png';
import { formatLongDate, fromDateInput } from '~/lib/dates';
import {
  addDays,
  addMonths,
  DEFAULT_DEADLINE_DAYS_BEFORE,
  PURGE_MONTHS_AFTER,
  WEDDING_LIMITS as L,
  weddingLabels,
  type WeddingInfo,
} from '../wedding';

const t = admin.wedding;

export type WeddingFormValues = WeddingInfo & { rsvpDeadline: string };
type Field = keyof WeddingFormValues;

const STEPS: Array<{ key: keyof typeof t.steps; fields: Field[] }> = [
  { key: 'couple', fields: ['partner1First', 'partner1Last', 'partner2First', 'partner2Last'] },
  { key: 'day', fields: ['weddingDate', 'ceremonyTime', 'receptionTime'] },
  { key: 'place', fields: ['venueName', 'venueCity', 'venueRegion', 'receptionPlace'] },
  { key: 'contact', fields: ['contactEmail', 'contactPhone', 'contactPhoneLabel', 'privacyEmail'] },
  { key: 'replies', fields: ['rsvpDeadline'] },
];
const REQUIRED: Field[] = [
  'partner1First',
  'partner1Last',
  'partner2First',
  'partner2Last',
  'weddingDate',
  'ceremonyTime',
  'venueName',
  'venueCity',
  'contactEmail',
  'privacyEmail',
  'rsvpDeadline',
];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Erreurs des champs (vérification légère ; le serveur revérifie tout). */
function check(v: WeddingFormValues, fields: Field[]): Partial<Record<Field, string>> {
  const e: Partial<Record<Field, string>> = {};
  for (const f of fields) {
    const value = String(v[f] ?? '').trim();
    if (REQUIRED.includes(f) && !value) e[f] = t.required;
    else if ((f === 'contactEmail' || f === 'privacyEmail') && !EMAIL_RE.test(value)) e[f] = t.invalidEmail;
    else if ((f === 'ceremonyTime' || (f === 'receptionTime' && value)) && !TIME_RE.test(value)) {
      e[f] = t.invalidTime;
    }
  }
  return e;
}

/** Erreurs renvoyées par le serveur ({ issues: [{ path, message }] }) → message par champ. */
function serverErrors(extra: Record<string, unknown>): Partial<Record<Field, string>> {
  const issues = Array.isArray(extra.issues)
    ? (extra.issues as Array<{ path?: string; message?: string }>)
    : [];
  const e: Partial<Record<Field, string>> = {};
  for (const i of issues) {
    const f = i.path as Field | undefined;
    if (!f) continue;
    e[f] =
      i.message === 'email'
        ? t.invalidEmail
        : i.message === 'phone'
          ? t.invalidPhone
          : i.message === 'time'
            ? t.invalidTime
            : t.required;
  }
  return e;
}

export default function WeddingForm({
  mode,
  initial,
}: {
  mode: 'setup' | 'edit';
  initial: WeddingFormValues;
}) {
  const setup = mode === 'setup';
  const [v, setV] = useState<WeddingFormValues>(initial);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [step, setStep] = useState(0);
  const [deadlineTouched, setDeadlineTouched] = useState(Boolean(initial.rsvpDeadline));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const set = (f: Field) => (e: Event) => {
    const value = (e.target as HTMLInputElement).value;
    setV((x) => {
      const next = { ...x, [f]: value };
      // date limite proposée : 18 jours avant, tant que les mariés ne l'ont pas choisie eux-mêmes
      if (f === 'weddingDate' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !deadlineTouched) {
        next.rsvpDeadline = addDays(value, -DEFAULT_DEADLINE_DAYS_BEFORE);
      }
      if (f === 'contactEmail' && (!x.privacyEmail || x.privacyEmail === x.contactEmail)) {
        next.privacyEmail = value;
      }
      return next;
    });
    if (f === 'rsvpDeadline') setDeadlineTouched(true);
    setErrors((er) => ({ ...er, [f]: undefined }));
  };

  const input = (
    f: Field,
    label: string,
    o: {
      type?: 'text' | 'email' | 'tel' | 'date' | 'time';
      max?: number;
      placeholder?: string;
      help?: string;
      autocomplete?: 'email' | 'tel' | 'off';
    } = {},
  ) => {
    const id = `w-${f}`;
    const err = errors[f];
    return (
      <label class="a-field" for={id}>
        {label}
        <input
          id={id}
          class="a-input"
          // Preact 11 type les attributs selon « type » : un seul gabarit pour tous les champs
          type={(o.type ?? 'text') as 'text'}
          value={String(v[f] ?? '')}
          onInput={set(f)}
          maxLength={o.max}
          placeholder={o.placeholder}
          autocomplete={o.autocomplete ?? 'off'}
          aria-invalid={err ? 'true' : undefined}
          aria-describedby={err ? `${id}-err` : o.help ? `${id}-help` : undefined}
        />
        {err ? (
          <span class="a-error wiz__err" id={`${id}-err`}>
            {err}
          </span>
        ) : (
          o.help && (
            <span class="a-hint wiz__help" id={`${id}-help`}>
              {o.help}
            </span>
          )
        )}
      </label>
    );
  };

  const sections: Record<keyof typeof t.steps, JSX.Element> = {
    couple: (
      <>
        {[1, 2].map((n) => (
          <fieldset class="wiz__pair" key={n}>
            <legend class="wiz__legend">{t.partner(n)}</legend>
            <div class="wiz__two">
              {input(n === 1 ? 'partner1First' : 'partner2First', t.first, { max: L.FIRST })}
              {input(n === 1 ? 'partner1Last' : 'partner2Last', t.last, { max: L.LAST })}
            </div>
          </fieldset>
        ))}
        <p class="a-hint wiz__note">{t.coupleHelp}</p>
      </>
    ),
    day: (
      <>
        {input('weddingDate', t.date, { type: 'date' })}
        <div class="wiz__two">
          {input('ceremonyTime', t.ceremonyTime, { type: 'time' })}
          {input('receptionTime', t.receptionTime, { type: 'time' })}
        </div>
      </>
    ),
    place: (
      <>
        {input('venueName', t.venueName, { max: L.VENUE, placeholder: t.venueNamePlaceholder })}
        <div class="wiz__two">
          {input('venueCity', t.venueCity, { max: L.CITY, placeholder: t.venueCityPlaceholder })}
          {input('venueRegion', t.venueRegion, { max: L.REGION, placeholder: t.venueRegionPlaceholder })}
        </div>
        {input('receptionPlace', t.receptionPlace, {
          max: L.RECEPTION_PLACE,
          placeholder: t.receptionPlacePlaceholder,
        })}
      </>
    ),
    contact: (
      <>
        {input('contactEmail', t.contactEmail, { type: 'email', max: L.EMAIL, autocomplete: 'email' })}
        <div class="wiz__two">
          {input('contactPhone', t.contactPhone, { type: 'tel', max: 40, autocomplete: 'tel' })}
          {input('contactPhoneLabel', t.contactPhoneLabel, {
            max: L.PHONE_LABEL,
            placeholder: t.contactPhoneLabelPlaceholder,
          })}
        </div>
        {input('privacyEmail', t.privacyEmail, { type: 'email', max: L.EMAIL, help: t.privacyHelp })}
      </>
    ),
    replies: (
      <>
        {input('rsvpDeadline', t.deadline, { type: 'date', help: t.deadlineHelp })}
        {/^\d{4}-\d{2}-\d{2}$/.test(v.weddingDate) && (
          <p class="a-hint wiz__note">
            {t.purgeInfo(formatLongDate(fromDateInput(addMonths(v.weddingDate, PURGE_MONTHS_AFTER), false)))}
          </p>
        )}
      </>
    ),
  };

  const goTo = (n: number) => {
    setStep(n);
    setMsg(null);
    document.querySelector('.wiz')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };
  const next = () => {
    const e = check(v, STEPS[step]!.fields);
    setErrors(e);
    if (Object.keys(e).length === 0) goTo(step + 1);
  };

  const submit = async (e: Event) => {
    e.preventDefault();
    // Entrée dans un champ de l'assistant : passer à l'étape suivante, pas tout envoyer
    if (setup && step < STEPS.length - 1) {
      next();
      return;
    }
    // l'installation ne part que par le bouton « Créer » (ou Entrée sur la dernière étape)
    const submitter = (e as SubmitEvent).submitter as HTMLElement | null;
    if (setup && submitter && submitter.dataset.action !== 'create') return;
    const fields = setup ? STEPS.flatMap((s) => s.fields) : STEPS.slice(0, 4).flatMap((s) => s.fields);
    const local = check(v, fields);
    setErrors(local);
    if (Object.keys(local).length) {
      if (setup) goTo(STEPS.findIndex((s) => s.fields.some((f) => local[f])));
      return;
    }
    setBusy(true);
    setMsg({ text: setup ? t.creating : t.saving, ok: true });
    const { rsvpDeadline, ...info } = v;
    const r = await api<{ wedding: WeddingInfo }>(
      setup ? 'POST' : 'PUT',
      '/api/admin/wedding',
      setup ? { ...info, rsvpDeadline } : info,
    );
    if (r.ok) {
      if (setup) {
        await uploadNamesPng(weddingLabels(r.data.wedding).couplePlain);
        location.href = '/admin';
        return;
      }
      setMsg({ text: t.saved, ok: true });
    } else {
      const fieldErrs = serverErrors(r.extra);
      setErrors(fieldErrs);
      setMsg({ text: r.status === 409 ? t.already : t.error, ok: false });
      if (setup && Object.keys(fieldErrs).length) {
        goTo(STEPS.findIndex((s) => s.fields.some((f) => fieldErrs[f])));
      }
    }
    setBusy(false);
  };

  const last = step === STEPS.length - 1;
  const status = msg && (
    <span class={msg.ok ? 'a-hint' : 'a-error'} role="status">
      {msg.text}
    </span>
  );

  if (!setup) {
    return (
      <form class="a-card wiz wiz--edit" onSubmit={submit} noValidate>
        <h2 class="a-card__title">{t.editTitle}</h2>
        <p class="a-hint wiz__note">{t.editHelp}</p>
        {STEPS.slice(0, 4).map((s) => (
          <fieldset class="wiz__section" key={s.key}>
            <legend class="wiz__section-title">{t.steps[s.key]}</legend>
            {sections[s.key]}
          </fieldset>
        ))}
        <div class="a-toolbar">
          <button class="a-btn a-btn--primary" type="submit" disabled={busy}>
            {t.save}
          </button>
          {status}
        </div>
      </form>
    );
  }

  const current = STEPS[step]!;
  const w =
    /^\d{4}-\d{2}-\d{2}$/.test(v.weddingDate) && v.partner1First && v.partner2First ? weddingLabels(v) : null;
  return (
    <form class="a-card wiz" onSubmit={submit} noValidate>
      <p class="a-eyebrow">{t.setupEyebrow}</p>
      <h2 class="a-card__title wiz__title">{t.setupTitle}</h2>
      <p class="a-hint wiz__note">{t.setupIntro}</p>
      <ol class="wiz__steps" aria-label={t.step(step + 1, STEPS.length)}>
        {STEPS.map((s, i) => (
          <li
            key={s.key}
            class={i === step ? 'is-current' : i < step ? 'is-done' : undefined}
            aria-current={i === step ? 'step' : undefined}
          >
            <span class="wiz__dot">{i + 1}</span>
            <span class="wiz__step-name">{t.steps[s.key]}</span>
          </li>
        ))}
      </ol>
      <fieldset class="wiz__section">
        <legend class="wiz__section-title">
          <span class="wiz__count">{t.step(step + 1, STEPS.length)}</span>
          {t.steps[current.key]}
        </legend>
        {sections[current.key]}
      </fieldset>
      {last && w && (
        <section class="wiz__recap" aria-label={t.recap}>
          <h3 class="wiz__recap-title">{t.recap}</h3>
          <p class="wiz__recap-names">{w.couple}</p>
          <p>
            {w.dateLong} · {w.ceremony}
            {w.reception ? ` · ${w.reception}` : ''}
          </p>
          <p>
            {w.venueWithCity}
            {w.venueRegion ? ` · ${w.venueRegion}` : ''}
          </p>
          <p>{w.contactEmail}</p>
        </section>
      )}
      <div class="a-toolbar wiz__nav">
        {step > 0 && (
          <button class="a-btn a-btn--outline" type="button" onClick={() => goTo(step - 1)} disabled={busy}>
            ← {t.previous}
          </button>
        )}
        <span class="a-spacer" />
        {/* clés distinctes : sans elles, Preact réutiliserait le bouton « Suivant » en bouton d'envoi pendant
            le clic, et le navigateur enverrait le formulaire sans passer par le récapitulatif */}
        {last ? (
          <button
            key="create"
            class="a-btn a-btn--primary"
            type="submit"
            data-action="create"
            disabled={busy}
          >
            {t.create}
          </button>
        ) : (
          <button key="next" class="a-btn a-btn--primary" type="button" onClick={next}>
            {t.next} →
          </button>
        )}
      </div>
      {status}
    </form>
  );
}
