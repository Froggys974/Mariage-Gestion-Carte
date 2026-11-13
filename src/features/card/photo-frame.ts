/**
 * Cadrage de la photo de la carte : forme (rectangle, rond, arche, ovale), point de cadrage et zoom.
 * La photo d'origine n'est jamais modifiée : le cadrage est appliqué à l'affichage (CSS sur le site et dans
 * l'admin, canvas pour l'image « Enregistrer la carte »), avec exactement le même calcul.
 * Aucun import Node ici (utilisé côté navigateur).
 */

export const PHOTO_SHAPES = ['rect', 'round', 'arch', 'oval'] as const;
export type PhotoShape = (typeof PHOTO_SHAPES)[number];

export interface PhotoFrame {
  shape: PhotoShape;
  /** point de cadrage horizontal, 0 (gauche) à 100 (droite) */
  x: number;
  /** point de cadrage vertical, 0 (haut) à 100 (bas) */
  y: number;
  /** 1 = la photo remplit juste la forme ; au-dessus on zoome (jusqu'à 3), en dessous toute la photo peut tenir */
  zoom: number;
}

export const FRAME = {
  /** proportions (largeur / hauteur) de la zone photo, identiques sur le site, dans l'admin et dans le PNG */
  ZONE_RATIO: 13 / 5,
  /** plancher absolu ; le vrai minimum dépend de la photo et de la forme (minZoom) */
  ZOOM_MIN: 0.1,
  ZOOM_MAX: 3,
} as const;

export const DEFAULT_FRAME: PhotoFrame = { shape: 'rect', x: 50, y: 50, zoom: 1 };

/** Largeur / hauteur de chaque forme ; null = toute la zone. */
export const SHAPE_RATIO: Record<PhotoShape, number | null> = {
  rect: null,
  round: 1,
  arch: 0.8,
  oval: 0.78,
};

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Proportions (largeur / hauteur) du cadre de la forme. */
export function shapeAspect(shape: PhotoShape): number {
  return SHAPE_RATIO[shape] ?? FRAME.ZONE_RATIO;
}

/**
 * Zoom minimum : toute la photo tient dans la forme (les vides prennent la couleur de la carte).
 * 1 si la photo a déjà les proportions de la forme.
 */
export function minZoom(shape: PhotoShape, iw: number, ih: number): number {
  const a = shapeAspect(shape);
  const r = iw / ih;
  const z = Math.min(a / r, r / a);
  return Math.max(FRAME.ZOOM_MIN, Math.floor(z * 100) / 100);
}

/** La photo ne remplit pas toute la forme (dézoom) : pas de filet autour du vide. */
export const isLoose = (f: PhotoFrame) => f.zoom < 1;

/** Valeur lue en base ou reçue du navigateur → cadrage valide (valeurs par défaut sinon). */
export function normalizeFrame(f: unknown): PhotoFrame {
  const o = (f && typeof f === 'object' ? f : {}) as Partial<Record<keyof PhotoFrame, unknown>>;
  const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
  return {
    shape: PHOTO_SHAPES.includes(o.shape as PhotoShape) ? (o.shape as PhotoShape) : DEFAULT_FRAME.shape,
    x: clamp(num(o.x, DEFAULT_FRAME.x), 0, 100),
    y: clamp(num(o.y, DEFAULT_FRAME.y), 0, 100),
    zoom: clamp(num(o.zoom, DEFAULT_FRAME.zoom), FRAME.ZOOM_MIN, FRAME.ZOOM_MAX),
  };
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Cadre de la forme dans la zone photo (centré, à pleine hauteur). */
export function shapeBox(shape: PhotoShape, zone: Box): Box {
  const ratio = SHAPE_RATIO[shape];
  if (ratio === null) return { ...zone };
  let h = zone.h;
  let w = h * ratio;
  if (w > zone.w) {
    w = zone.w;
    h = w / ratio;
  }
  return { x: zone.x + (zone.w - w) / 2, y: zone.y + (zone.h - h) / 2, w, h };
}

/**
 * Position de l'image (iw × ih) dans un cadre fw × fh : « cover », puis point de cadrage et zoom.
 * Équivaut en CSS à object-fit: cover; object-position: x% y%; transform: scale(zoom) depuis x% y%.
 * Résultat relatif au coin du cadre. Zoom ≥ 1 : l'image couvre tout le cadre ; zoom < 1 : elle est plus petite
 * et le point de cadrage la place (0 = à gauche / en haut, 100 = à droite / en bas).
 */
export function placeImage(iw: number, ih: number, fw: number, fh: number, f: PhotoFrame): Box {
  const s = Math.max(fw / iw, fh / ih) * f.zoom;
  const w = iw * s;
  const h = ih * s;
  // « + 0 » : évite -0 (sans effet à l'affichage, mais plus lisible dans les tests)
  return { x: (f.x / 100) * (fw - w) + 0, y: (f.y / 100) * (fh - h) + 0, w, h };
}

/**
 * Glisser la photo de (dx, dy) pixels dans un cadre fw × fh : nouveau point de cadrage.
 * L'image suit le doigt ; zoomée, elle ne laisse jamais de bord vide ; dézoomée, elle reste dans la forme.
 */
export function dragFrame(
  f: PhotoFrame,
  dx: number,
  dy: number,
  img: { w: number; h: number },
  frame: { w: number; h: number },
): PhotoFrame {
  const p = placeImage(img.w, img.h, frame.w, frame.h, f);
  const spanX = frame.w - p.w; // marge de déplacement (négative si l'image déborde)
  const spanY = frame.h - p.h;
  const x = Math.abs(spanX) > 0.5 ? f.x + (dx / spanX) * 100 : f.x;
  const y = Math.abs(spanY) > 0.5 ? f.y + (dy / spanY) * 100 : f.y;
  return { ...f, x: Math.round(clamp(x, 0, 100) * 10) / 10, y: Math.round(clamp(y, 0, 100) * 10) / 10 };
}

/**
 * Variables CSS du cadrage (site et admin) : position et taille de l'image en % du cadre de la forme,
 * calculées par placeImage — le même calcul que le canvas du PNG, au pixel près, zoomé ou dézoomé.
 */
export function frameStyle(f: PhotoFrame, iw: number, ih: number): Record<string, string> {
  const a = shapeAspect(f.shape);
  const p = placeImage(iw, ih, a, 1, f);
  const pct = (v: number) => `${Math.round(v * 10000) / 100}%`;
  return { '--ph-l': pct(p.x / a), '--ph-t': pct(p.y), '--ph-w': pct(p.w / a), '--ph-h': pct(p.h) };
}

/** Trace la forme dans un canvas (pour le découpage et le filet). */
export function traceShape(ctx: CanvasRenderingContext2D, shape: PhotoShape, b: Box, radius = 8): void {
  ctx.beginPath();
  if (shape === 'round' || shape === 'oval') {
    ctx.ellipse(b.x + b.w / 2, b.y + b.h / 2, b.w / 2, b.h / 2, 0, 0, Math.PI * 2);
  } else if (shape === 'arch') {
    const r = b.w / 2;
    ctx.moveTo(b.x, b.y + b.h);
    ctx.lineTo(b.x, b.y + r);
    ctx.arc(b.x + r, b.y + r, r, Math.PI, 0);
    ctx.lineTo(b.x + b.w, b.y + b.h);
    ctx.closePath();
  } else if (ctx.roundRect) {
    ctx.roundRect(b.x, b.y, b.w, b.h, radius);
  } else {
    ctx.rect(b.x, b.y, b.w, b.h);
  }
}
