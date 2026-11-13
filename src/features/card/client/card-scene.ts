/** Scène Faire\u2011part : enveloppe, boutons après ouverture, enregistrement de la carte. */
import { card as t } from '~/content/fr';
import type { AppContext } from '../../invitation/client/features';
import type { SheetController } from '../../invitation/client/sheets';
import { frameStyle } from '../photo-frame';
import { saveCard } from './card-png';
import * as envelope from './envelope';

export const CARD_SCENE = { AUTO_OPEN_DELAY_MS: 400 } as const;

export function mount(ctx: AppContext, sheets: SheetController): envelope.EnvelopeController | null {
  const env = ctx.root.querySelector<HTMLElement>('[data-envelope]');
  const closed = ctx.root.querySelector<HTMLElement>('[data-card-closed]');
  const opened = ctx.root.querySelector<HTMLElement>('[data-card-open]');
  const hint = ctx.root.querySelector<HTMLElement>('[data-card-hint]');
  if (!env || !closed || !opened || !hint) return null;

  // cadrage de la photo (variables CSS posées par le CSSOM : la CSP interdit les styles écrits dans le HTML)
  const photo = env.querySelector<HTMLElement>('[data-photo-frame]');
  const ph = ctx.boot.card.photo;
  if (photo && ph) {
    for (const [k, v] of Object.entries(frameStyle(ctx.boot.card.frame, ph.width, ph.height))) {
      photo.style.setProperty(k, v);
    }
  }

  const ctl = envelope.init(env, {
    fx: ctx.fx,
    mode: () => ctx.mode,
    onOpened() {
      closed.hidden = true;
      opened.hidden = false;
    },
    onReset() {
      opened.hidden = true;
      closed.hidden = false;
      hint.textContent = t.saveHint;
    },
  });

  const viewerImg = ctx.root.querySelector<HTMLImageElement>('[data-card-img]');
  ctx.root.querySelector('[data-card-save]')?.addEventListener('click', async () => {
    const result = await saveCard(ctx.boot.card, {
      fileName: ctx.boot.wedding.cardFileName,
      title: t.shareTitle(ctx.boot.wedding),
      showViewer(url) {
        if (!viewerImg) return;
        viewerImg.src = url;
        sheets.open('card-image');
      },
    });
    if (result === 'downloaded') hint.textContent = t.savedHint;
    else if (result === 'shared') hint.textContent = t.sharedHint;
    else if (result === 'viewer') hint.textContent = t.longPressHint;
  });
  ctx.root.querySelector('[data-card-replay]')?.addEventListener('click', () => ctl.replay());

  if (ctx.params.get('open') === '1') window.setTimeout(() => ctl.open(), CARD_SCENE.AUTO_OPEN_DELAY_MS);
  return ctl;
}
