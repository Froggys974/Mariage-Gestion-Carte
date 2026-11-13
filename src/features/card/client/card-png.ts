/**
 * « Enregistrer la carte » : image PNG 1080 × 1512 dessinée sur un canvas (prototype : drawCard).
 * Avec photo, la mise en page laisse place à la photo entre les heures et le message.
 * Navigateurs intégrés (WhatsApp, Instagram, Facebook) : partage natif, sinon visionneuse « appui long ».
 */
import { PALETTE } from '~/lib/fx/flowers';
import type { BootCard } from '../../invitation/boot';
import { placeImage, shapeBox, traceShape } from '../photo-frame';

export const PNG = {
  W: 1080,
  H: 1512,
  FRAME: 44,
  MAX_TEXT_W: 900,
  FONTS: [
    "120px 'Pinyon Script'",
    "italic 300 74px 'Cormorant Garamond'",
    "400 46px 'Cormorant Garamond'",
    "italic 400 42px 'Cormorant Garamond'",
    "500 28px 'Spline Sans'",
    "300 34px 'Spline Sans'",
  ],
} as const;

/** Mise en page verticale (ordonnées des lignes de base). Sans photo : celle du prototype. */
export function layout(hasPhoto: boolean) {
  return hasPhoto
    ? {
        date: 230,
        name1: 390,
        amp: 478,
        name2: 576,
        rule: 636,
        place: [706, 760],
        times: 826,
        // zone photo : 780 × 300 (proportions 13/5, comme sur le site)
        photo: { y: 910, h: 300, x: 150 },
        msg: [1330, 1395],
      }
    : {
        date: 300,
        name1: 470,
        amp: 562,
        name2: 664,
        rule: 730,
        place: [810, 872],
        times: 950,
        photo: null,
        msg: [1120, 1190],
      };
}

/** « 19 · 12 · 2026 » → « 1 9   ·   1 2   ·   2 0 2 6 » (lettres espacées du prototype). */
export function spacedDate(label: string): string {
  return label
    .split('·')
    .map((p) => p.trim().split('').join(' '))
    .join('   ·   ');
}

/** Les polices du canvas n'ont pas toujours le trait d'union insécable. */
export function canvasText(s: string): string {
  return s.replaceAll(String.fromCharCode(0x2011), '-').replaceAll(String.fromCharCode(0xa0), ' ');
}

function splitNames(names: string): [string, string | null] {
  const i = names.indexOf('&');
  return i < 0 ? [names.trim(), null] : [names.slice(0, i).trim(), names.slice(i + 1).trim()];
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export async function drawCard(card: BootCard): Promise<HTMLCanvasElement> {
  if (document.fonts?.load) {
    await Promise.all(PNG.FONTS.map((f) => document.fonts.load(f).catch(() => undefined)));
  }
  const photo = card.photo ? await loadImage(card.photo.fallback.replace('-800.jpg', '-1200.jpg')) : null;
  const { W, H } = PNG;
  const L = layout(Boolean(photo));
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const x = c.getContext('2d');
  if (!x) return c;

  const g = x.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#fbf7ee');
  g.addColorStop(1, '#efe4cc');
  x.fillStyle = g;
  x.fillRect(0, 0, W, H);

  const flower = (cx: number, cy: number, r: number, [c1, c2]: readonly [string, string], rot: number) => {
    for (let k = 0; k < 5; k++) {
      x.save();
      x.translate(cx, cy);
      x.rotate(rot + (k * Math.PI * 2) / 5);
      const lg = x.createLinearGradient(0, 0, 0, r);
      lg.addColorStop(0, c1);
      lg.addColorStop(0.65, c2);
      x.fillStyle = lg;
      x.beginPath();
      x.ellipse(0, r * 0.5, r * 0.38, r * 0.52, 0, 0, Math.PI * 2);
      x.fill();
      x.restore();
    }
    x.fillStyle = '#f6c25a';
    x.beginPath();
    x.arc(cx, cy, r * 0.16, 0, Math.PI * 2);
    x.fill();
  };
  flower(60, 60, 170, PALETTE.hibiscus, 0.3);
  flower(230, 30, 90, PALETTE.frangipani, 1);
  flower(W - 50, H - 60, 180, PALETTE.frangipani, 0.6);
  flower(W - 230, H - 20, 100, PALETTE.bougain, 0.2);
  x.strokeStyle = 'rgba(28,51,38,.22)';
  x.lineWidth = 3;
  x.strokeRect(PNG.FRAME, PNG.FRAME, W - 2 * PNG.FRAME, H - 2 * PNG.FRAME);

  const text = (s: string, y: number, font: string, color: string) => {
    x.font = font;
    x.fillStyle = color;
    const t = canvasText(s);
    const w = x.measureText(t).width;
    if (w > PNG.MAX_TEXT_W) {
      x.save();
      x.translate(W / 2, y);
      x.scale(PNG.MAX_TEXT_W / w, 1);
      x.fillText(t, 0, 0);
      x.restore();
    } else x.fillText(t, W / 2, y);
  };
  x.textAlign = 'center';
  text(spacedDate(card.date), L.date, "500 28px 'Spline Sans', sans-serif", '#7a6a45');
  const [n1, n2] = splitNames(card.names);
  if (n2) {
    text(n1, L.name1, "400 124px 'Pinyon Script', cursive", '#1c3326');
    text('&', L.amp, "italic 300 74px 'Cormorant Garamond', Georgia, serif", '#a8894a');
    text(n2, L.name2, "400 124px 'Pinyon Script', cursive", '#1c3326');
  } else {
    text(n1, L.amp, "400 124px 'Pinyon Script', cursive", '#1c3326');
  }
  x.strokeStyle = '#c9b483';
  x.lineWidth = 2;
  x.beginPath();
  x.moveTo(W / 2 - 90, L.rule);
  x.lineTo(W / 2 + 90, L.rule);
  x.stroke();
  const place = card.place.split(/\r?\n/);
  place.slice(0, 2).forEach((line, i) => {
    text(line, L.place[i] ?? L.place[0]!, "400 46px 'Cormorant Garamond', Georgia, serif", '#2c4634');
  });
  text(
    `Cérémonie ${card.ceremony}   ·   Réception ${card.reception}`.toUpperCase(),
    L.times,
    "500 28px 'Spline Sans', sans-serif",
    '#7a6a45',
  );
  if (photo && L.photo) {
    const { y, h, x: px } = L.photo;
    // forme, point de cadrage et zoom choisis dans l'admin (même calcul que le CSS du site)
    const box = shapeBox(card.frame.shape, { x: px, y, w: W - 2 * px, h });
    const p = placeImage(photo.naturalWidth, photo.naturalHeight, box.w, box.h, card.frame);
    x.save();
    traceShape(x, card.frame.shape, box);
    x.clip();
    x.drawImage(photo, box.x + p.x, box.y + p.y, p.w, p.h);
    x.restore();
    if (card.frame.zoom >= 1) {
      // pas de filet autour d'une photo dézoomée (comme sur le site)
      x.strokeStyle = 'rgba(28,51,38,.25)';
      x.lineWidth = 2;
      traceShape(x, card.frame.shape, box);
      x.stroke();
    }
  }
  const [m1 = '', ...rest] = card.message.split(/\r?\n/);
  text(m1, L.msg[0]!, "300 34px 'Spline Sans', sans-serif", '#40543f');
  if (rest.length)
    text(rest.join(' '), L.msg[1]!, "italic 400 42px 'Cormorant Garamond', Georgia, serif", '#40543f');
  return c;
}

export function toBlob(c: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => c.toBlob((b) => resolve(b), 'image/png'));
}

/** Navigateurs intégrés aux applications : le téléchargement y est souvent impossible. */
export function isInAppBrowser(ua: string): boolean {
  return /FBAN|FBAV|FB_IAB|Instagram|WhatsApp|Line\/|Snapchat|TikTok|; wv\)|GSA\//i.test(ua);
}

export type SaveResult = 'downloaded' | 'shared' | 'viewer' | 'cancelled';

export async function saveCard(
  card: BootCard,
  opts: { fileName: string; title: string; showViewer: (url: string) => void },
): Promise<SaveResult> {
  const canvas = await drawCard(card);
  const blob = await toBlob(canvas);
  if (!blob) return 'cancelled';
  const inApp = isInAppBrowser(navigator.userAgent);
  if (inApp) {
    const file = new File([blob], opts.fileName, { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: opts.title });
        return 'shared';
      } catch (err) {
        if ((err as DOMException).name === 'AbortError') return 'cancelled';
      }
    }
    opts.showViewer(URL.createObjectURL(blob));
    return 'viewer';
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = opts.fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'downloaded';
}
