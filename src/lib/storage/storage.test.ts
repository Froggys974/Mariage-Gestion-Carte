import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { afterAll, describe, expect, it } from 'vitest';
import { ImageRejectedError, processPhoto, storeNamesImage } from './images';
import { assertKey, LocalVolumeStorage } from './storage';

const dir = mkdtempSync(join(tmpdir(), 'rcgn-store-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('stockage local', () => {
  it('écrit, relit et supprime par préfixe', async () => {
    const s = new LocalVolumeStorage(dir);
    await s.put('card/photo-a-400.webp', Buffer.from('x'), 'image/webp');
    expect((await s.get('card/photo-a-400.webp'))?.contentType).toBe('image/webp');
    await s.deletePrefix('card/photo-a');
    expect(await s.get('card/photo-a-400.webp')).toBeNull();
  });
  it('refuse les chemins qui sortent du dossier', () => {
    expect(() => assertKey('../etc/passwd')).toThrow();
    expect(() => assertKey('/etc/passwd')).toThrow();
    expect(() => assertKey('card/../../x')).toThrow();
  });
});

describe('photo (sharp)', () => {
  it('produit AVIF, WebP et JPEG en 400/800/1200 px', async () => {
    const jpeg = await sharp({ create: { width: 1600, height: 1000, channels: 3, background: '#c99a4c' } })
      .jpeg()
      .toBuffer();
    const p = await processPhoto(jpeg);
    expect(p.base).toMatch(/^card\/photo-[0-9a-f]{12}_1600x1000$/);
    expect(p.files).toHaveLength(9);
    const w800 = p.files.find((f) => f.key.endsWith('-800.webp'))!;
    expect((await sharp(w800.data).metadata()).width).toBe(800);
  });
  it('n’agrandit pas une petite photo', async () => {
    const png = await sharp({ create: { width: 300, height: 200, channels: 3, background: '#fff' } })
      .png()
      .toBuffer();
    const p = await processPhoto(png);
    const big = p.files.find((f) => f.key.endsWith('-1200.jpg'))!;
    expect((await sharp(big.data).metadata()).width).toBe(300);
  });
  it('refuse un fichier qui n’est pas une image', async () => {
    await expect(processPhoto(Buffer.from('pas une image'))).rejects.toBeInstanceOf(ImageRejectedError);
  });
  it('refuse une image tronquée (en-tête valide, données coupées)', async () => {
    const jpeg = await sharp({ create: { width: 1600, height: 1000, channels: 3, background: '#123' } })
      .jpeg()
      .toBuffer();
    await expect(processPhoto(jpeg.subarray(0, 400))).rejects.toBeInstanceOf(ImageRejectedError);
  });
});

describe('image des noms', () => {
  it('refuse un contenu qui n’est pas une image', async () => {
    const s = new LocalVolumeStorage(dir);
    await expect(storeNamesImage(s, Buffer.from('pas un png'))).rejects.toBeInstanceOf(ImageRejectedError);
  });
});
