import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FRAME,
  dragFrame,
  isLoose,
  minZoom,
  normalizeFrame,
  placeImage,
  shapeBox,
  type PhotoFrame,
} from './photo-frame';

const zone = { x: 150, y: 910, w: 780, h: 300 };
const f = (p: Partial<PhotoFrame> = {}): PhotoFrame => ({ ...DEFAULT_FRAME, ...p });

describe('cadrage de la photo', () => {
  it('lit un cadrage invalide ou absent comme un rectangle centré', () => {
    expect(normalizeFrame(null)).toEqual(DEFAULT_FRAME);
    expect(normalizeFrame({ shape: 'oval', x: 50, y: 50, zoom: 0.01 }).zoom).toBe(0.1);
    expect(normalizeFrame({ shape: 'étoile', x: -5, y: 140, zoom: 9 })).toEqual({
      shape: 'rect',
      x: 0,
      y: 100,
      zoom: 3,
    });
    expect(normalizeFrame({ shape: 'arch', x: 30, y: 70, zoom: 1.5 })).toEqual({
      shape: 'arch',
      x: 30,
      y: 70,
      zoom: 1.5,
    });
  });

  it('place chaque forme au centre de la zone, à pleine hauteur', () => {
    expect(shapeBox('rect', zone)).toEqual(zone);
    expect(shapeBox('round', zone)).toEqual({ x: 390, y: 910, w: 300, h: 300 });
    expect(shapeBox('arch', zone)).toEqual({ x: 420, y: 910, w: 240, h: 300 });
    // zone plus haute que large : la forme est limitée par la largeur
    expect(shapeBox('round', { x: 0, y: 0, w: 100, h: 200 })).toEqual({ x: 0, y: 50, w: 100, h: 100 });
  });

  it('« cover » centré par défaut, puis point de cadrage et zoom (comme object-position + scale)', () => {
    // photo 3:2 dans un carré 300 : hauteur pleine, largeur 450, centrée
    expect(placeImage(1200, 800, 300, 300, f())).toEqual({ x: -75, y: 0, w: 450, h: 300 });
    // cadrage à gauche
    expect(placeImage(1200, 800, 300, 300, f({ x: 0 }))).toEqual({ x: 0, y: 0, w: 450, h: 300 });
    // zoom ×2 centré : l'image reste centrée et couvre toujours le cadre
    const z = placeImage(1200, 800, 300, 300, f({ zoom: 2 }));
    expect(z).toEqual({ x: -300, y: -150, w: 900, h: 600 });
    expect(z.x <= 0 && z.y <= 0 && z.x + z.w >= 300 && z.y + z.h >= 300).toBe(true);
  });

  it('glisser : l’image suit le doigt, sans jamais laisser de bord vide', () => {
    const img = { w: 1200, h: 800 };
    const box = { w: 300, h: 300 };
    // vers la droite : on découvre la gauche de la photo (x diminue)
    const right = dragFrame(f(), 75, 0, img, box);
    expect(right.x).toBe(0);
    expect(placeImage(1200, 800, 300, 300, right).x).toBe(0);
    // trop loin : bloqué au bord
    expect(dragFrame(f(), -500, 0, img, box).x).toBe(100);
    // pas de marge verticale sans zoom : y ne bouge pas ; avec zoom, si
    expect(dragFrame(f(), 0, 40, img, box).y).toBe(50);
    expect(dragFrame(f({ zoom: 2 }), 0, 60, img, box).y).toBe(30);
  });

  it('dézoom : jusqu’à voir toute la photo, placée par le point de cadrage', () => {
    // photo 4:3 dans le rectangle 13/5 : toute la photo tient à 0,51 (hauteur pleine)
    expect(minZoom('rect', 1600, 1200)).toBe(0.51);
    expect(minZoom('round', 1600, 1200)).toBe(0.75);
    expect(minZoom('round', 1000, 1000)).toBe(1);
    // rectangle 780 × 300, photo 4:3 au zoom minimum : hauteur 300, largeur 400, centrée
    const p = placeImage(1600, 1200, 780, 300, f({ zoom: 0.5128 }));
    expect(Math.round(p.h)).toBe(300);
    expect(Math.round(p.w)).toBe(400);
    expect(Math.round(p.x)).toBe(190);
    expect(isLoose(f({ zoom: 0.6 }))).toBe(true);
    expect(isLoose(f({ zoom: 1 }))).toBe(false);
    // dézoomée : glisser à droite la déplace à droite, sans sortir de la forme
    const moved = dragFrame(f({ zoom: 0.5128 }), 100, 0, { w: 1600, h: 1200 }, { w: 780, h: 300 });
    expect(moved.x).toBeGreaterThan(50);
    expect(dragFrame(f({ zoom: 0.5128 }), 1000, 0, { w: 1600, h: 1200 }, { w: 780, h: 300 }).x).toBe(100);
  });
});
