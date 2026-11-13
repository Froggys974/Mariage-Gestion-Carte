/**
 * Feuilles du bas (dialogues modaux) : ouverture, focus piégé, Échap, retour du focus,
 * et suivi de visualViewport pour que le clavier mobile ne masque jamais le champ actif.
 */

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface SheetController {
  open(id: string, opts?: { focus?: string }): void;
  close(id?: string): void;
  isOpen(id?: string): boolean;
  onClose(id: string, fn: () => void): void;
  destroy(): void;
}

export function init(root: HTMLElement, overlays: Set<string>): SheetController {
  const scrims = new Map<string, HTMLElement>();
  root.querySelectorAll<HTMLElement>('[data-sheet]').forEach((el) => scrims.set(el.dataset.sheet ?? '', el));
  const closeHandlers = new Map<string, Array<() => void>>();
  let current: string | null = null;
  let returnFocus: HTMLElement | null = null;

  const panel = (id: string) => scrims.get(id)?.querySelector<HTMLElement>('.sheet') ?? null;

  // Clavier mobile : la feuille remonte au-dessus et le champ actif reste visible.
  const vv = window.visualViewport;
  const followViewport = () => {
    if (!current || !vv) return;
    const p = panel(current);
    if (!p) return;
    const hidden = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
    p.style.transform = hidden > 0 ? `translate3d(0,${-hidden}px,0)` : '';
    p.style.maxHeight = `${Math.round(vv.height * 0.9)}px`;
    const active = document.activeElement as HTMLElement | null;
    if (active && p.contains(active) && active.matches('input, textarea')) {
      active.scrollIntoView({ block: 'nearest' });
    }
  };
  vv?.addEventListener('resize', followViewport);
  vv?.addEventListener('scroll', followViewport);

  const onFocusIn = (e: FocusEvent) => {
    if (!current) return;
    const p = panel(current);
    const t = e.target as HTMLElement;
    if (p && !p.contains(t)) {
      (p.querySelector<HTMLElement>(FOCUSABLE) ?? p).focus();
    } else if (t.matches('input, textarea')) {
      // laisser le clavier apparaître avant d'ajuster
      window.setTimeout(followViewport, 300);
    }
  };
  const onKey = (e: KeyboardEvent) => {
    if (!current) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      ctl.close();
      return;
    }
    if (e.key !== 'Tab') return;
    const p = panel(current);
    if (!p) return;
    const items = Array.from(p.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (el) => el.offsetParent !== null,
    );
    if (!items.length) return;
    const first = items[0]!;
    const last = items[items.length - 1]!;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };
  document.addEventListener('focusin', onFocusIn);
  document.addEventListener('keydown', onKey);
  root.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('[data-sheet-close]')) ctl.close();
  });

  const ctl: SheetController = {
    open(id, opts) {
      const scrim = scrims.get(id);
      if (!scrim) return;
      if (current && current !== id) ctl.close(current);
      returnFocus = document.activeElement as HTMLElement | null;
      scrim.hidden = false;
      current = id;
      overlays.add(`sheet:${id}`);
      const p = panel(id);
      const target = (opts?.focus ? p?.querySelector<HTMLElement>(opts.focus) : null) ?? p;
      target?.focus({ preventScroll: true });
      followViewport();
    },
    close(id) {
      const target = id ?? current;
      if (!target) return;
      const scrim = scrims.get(target);
      if (scrim) scrim.hidden = true;
      const p = panel(target);
      if (p) {
        p.style.transform = '';
        p.style.maxHeight = '';
      }
      overlays.delete(`sheet:${target}`);
      if (current === target) current = null;
      closeHandlers.get(target)?.forEach((fn) => fn());
      returnFocus?.focus?.({ preventScroll: true });
      returnFocus = null;
    },
    isOpen(id) {
      return id ? current === id : current !== null;
    },
    onClose(id, fn) {
      const list = closeHandlers.get(id) ?? [];
      list.push(fn);
      closeHandlers.set(id, list);
    },
    destroy() {
      vv?.removeEventListener('resize', followViewport);
      vv?.removeEventListener('scroll', followViewport);
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('keydown', onKey);
    },
  };
  return ctl;
}
