/**
 * Image des noms en Pinyon Script pour les emails (les clients mail ne chargent pas les polices web).
 * Dessinée dans le navigateur des mariés puis envoyée au serveur ; partagée par l'éditeur de carte et
 * l'assistant d'installation.
 */
const NAMES_IMG = { W: 640, FONT_PX: 84, LINE: 1.08, PAD: 20 } as const;

function csrf(): string {
  return document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? '';
}

export async function renderNamesPng(names: string): Promise<Blob | null> {
  await document.fonts.load(`${NAMES_IMG.FONT_PX}px 'Pinyon Script'`).catch(() => undefined);
  await document.fonts.load(`italic 400 52px 'Cormorant Garamond'`).catch(() => undefined);
  const i = names.indexOf('&');
  const lines = i < 0 ? [names.trim()] : [names.slice(0, i).trim(), '&', names.slice(i + 1).trim()];
  const lh = NAMES_IMG.FONT_PX * NAMES_IMG.LINE;
  const c = document.createElement('canvas');
  c.width = NAMES_IMG.W;
  c.height = Math.round(lines.length * lh + NAMES_IMG.PAD * 2);
  const x = c.getContext('2d');
  if (!x) return null;
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  lines.forEach((l, k) => {
    const amp = l === '&';
    x.font = amp
      ? `italic 400 52px 'Cormorant Garamond', serif`
      : `400 ${NAMES_IMG.FONT_PX}px 'Pinyon Script', cursive`;
    x.fillStyle = amp ? '#a8894a' : '#1c3326';
    const w = x.measureText(l).width;
    const y = NAMES_IMG.PAD + lh * (k + 0.5);
    if (w > NAMES_IMG.W - 20) {
      x.save();
      x.translate(NAMES_IMG.W / 2, y);
      x.scale((NAMES_IMG.W - 20) / w, 1);
      x.fillText(l, 0, 0);
      x.restore();
    } else x.fillText(l, NAMES_IMG.W / 2, y);
  });
  return new Promise((resolve) => c.toBlob(resolve, 'image/png'));
}

/** Dessine puis enregistre l'image des noms (sans bloquer en cas d'échec : les emails écrivent alors les noms). */
export async function uploadNamesPng(names: string): Promise<void> {
  const png = await renderNamesPng(names);
  if (!png) return;
  await fetch('/api/admin/card/names-image', {
    method: 'POST',
    headers: { 'content-type': 'image/png', 'x-csrf-token': csrf() },
    body: png,
  }).catch(() => undefined);
}
