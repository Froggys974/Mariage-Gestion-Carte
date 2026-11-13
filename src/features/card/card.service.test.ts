import { describe, expect, it } from 'vitest';
import { splitMessage, splitNames } from './card.service';
import { photoSources } from './photo';

describe('carte', () => {
  it('sépare les noms autour du « & »', () => {
    expect(splitNames('Marie-Ange & Jean Luc')).toEqual(['Marie-Ange', 'Jean Luc']);
    expect(splitNames('Marie-Ange')).toEqual(['Marie-Ange', null]);
  });
  it('sépare le message : ligne créole puis ligne italique', () => {
    expect(splitMessage('Nou lé kontan.\nVotre présence.')).toEqual(['Nou lé kontan.', 'Votre présence.']);
    expect(splitMessage('Une seule ligne')).toEqual(['Une seule ligne', '']);
  });
  it('construit les srcset AVIF / WebP de la photo', () => {
    const p = photoSources('card/photo-abc_1600x1067');
    expect(p?.avif).toContain('/media/card/photo-abc_1600x1067-400.avif 400w');
    expect(p?.webp).toContain('-1200.webp 1200w');
    expect(p?.fallback).toBe('/media/card/photo-abc_1600x1067-800.jpg');
    expect(p?.width).toBe(1600);
    expect(photoSources(null)).toBeNull();
  });
});
