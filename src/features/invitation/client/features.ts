/** Montage des fonctionnalités des scènes (faire-part, table, feuilles). */
import type { ConfettiController } from '~/lib/fx/confetti';
import * as cardScene from '../../card/client/card-scene';
import * as cardEmail from '../../card/client/card-email';
import * as lostLink from '../../rsvp/client/lost-link';
import * as draftSync from '../../rsvp/client/draft-sync';
import * as rsvpUi from '../../rsvp/client/rsvp-ui';
import type { GuestBoot } from '../boot';
import type { MotionMode } from './perf-mode';
import type { NavController } from './scene-nav';
import * as sheets from './sheets';

export interface AppContext {
  boot: GuestBoot;
  root: HTMLElement;
  params: URLSearchParams;
  readonly mode: MotionMode;
  fx: ConfettiController | null;
  nav: NavController;
  /** surcouches ouvertes (menu, feuilles) : bloquent la navigation */
  overlays: Set<string>;
  goTo(i: number): void;
  rise(i: number, delay?: number): void;
  onScene(fn: (i: number) => void): void;
  onFrame(fn: (dt: number, now: number, p: number) => void): void;
  onModeChange(fn: (m: MotionMode) => void): void;
}

export function mountFeatures(ctx: AppContext): void {
  const sheetCtl = sheets.init(ctx.root, ctx.overlays);
  lostLink.init(ctx.root, sheetCtl);
  cardScene.mount(ctx, sheetCtl);
  cardEmail.mount(ctx, sheetCtl);
  const { boot } = ctx;
  if (boot.token) {
    // Première ouverture (compte seulement si le script s'exécute : pas les robots d'aperçu)
    void fetch(`/api/rsvp/${encodeURIComponent(boot.token)}/open`, { method: 'POST', keepalive: true }).catch(
      () => undefined,
    );
    const sync = draftSync.create({
      token: boot.token,
      updatedAt: boot.updatedAt,
      draftUpdatedAt: boot.draftUpdatedAt,
      seats: boot.seats,
    });
    rsvpUi.mount(ctx, sheetCtl, sync);
  } else {
    rsvpUi.mount(ctx, sheetCtl, {
      draftChanged() {},
      submit: async () => ({ ok: false, reason: 'error' }),
      decline: async () => ({ ok: false, reason: 'error' }),
    });
  }
}
