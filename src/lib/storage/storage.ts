/**
 * Stockage des fichiers envoyés (photo de la carte, image des noms).
 * Interface commune ; implémentation actuelle : volume Docker /data/uploads.
 * Pour passer à S3 plus tard, il suffit d'ajouter une implémentation de `Storage`.
 */
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { getEnv } from '../env';

export interface StoredFile {
  data: Buffer;
  contentType: string;
}

export interface Storage {
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<StoredFile | null>;
  /** supprime toutes les clés commençant par `prefix` */
  deletePrefix(prefix: string): Promise<void>;
}

const KEY_RE = /^[a-z0-9][a-z0-9/_.-]{0,200}$/i;

export function assertKey(key: string): void {
  if (!KEY_RE.test(key) || key.includes('..') || key.includes('//'))
    throw new Error('clé de stockage invalide');
}

export const CONTENT_TYPES: Record<string, string> = {
  avif: 'image/avif',
  webp: 'image/webp',
  jpg: 'image/jpeg',
  png: 'image/png',
};

export class LocalVolumeStorage implements Storage {
  private readonly root: string;
  constructor(dir: string) {
    this.root = resolve(dir);
  }
  private path(key: string): string {
    assertKey(key);
    const p = resolve(this.root, key);
    if (!p.startsWith(this.root + sep)) throw new Error('clé de stockage invalide');
    return p;
  }
  async put(key: string, data: Buffer, _contentType?: string): Promise<void> {
    const p = this.path(key);
    await mkdir(dirname(p), { recursive: true });
    await writeFile(p, data);
  }
  async get(key: string): Promise<StoredFile | null> {
    try {
      const data = await readFile(this.path(key));
      const ext = key.split('.').pop() ?? '';
      return { data, contentType: CONTENT_TYPES[ext] ?? 'application/octet-stream' };
    } catch {
      return null;
    }
  }
  async deletePrefix(prefix: string): Promise<void> {
    assertKey(prefix);
    const dir = dirname(this.path(`${prefix}x`));
    const { readdir } = await import('node:fs/promises');
    let names: string[];
    try {
      names = await readdir(dir);
    } catch {
      return;
    }
    const base = prefix.split('/').pop() ?? '';
    await Promise.all(
      names.filter((n) => n.startsWith(base)).map((n) => rm(resolve(dir, n), { force: true })),
    );
  }
}

let instance: Storage | undefined;
export function getStorage(): Storage {
  instance ??= new LocalVolumeStorage(getEnv().UPLOAD_DIR);
  return instance;
}
