/**
 * Budget JavaScript du site invité : somme gzip de tous les modules chargés par une page invité
 * (scripts + imports statiques). Échoue au-delà de 60 Ko.
 * Usage : pnpm budget:js [url]   (serveur de production démarré)
 */
import { gzipSync } from 'node:zlib';

const BUDGET_KB = 60;
const base = process.env.BUDGET_BASE ?? 'http://localhost:4321';
const pages = process.argv.slice(2).length ? process.argv.slice(2) : ['/', '/i/ODpIYKP2La9V6XE0plvjVA'];

async function text(url: string): Promise<string> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} → ${r.status}`);
  return r.text();
}

let worst = 0;
for (const page of pages) {
  const html = await text(base + page);
  const queue = [
    ...html.matchAll(/<script[^>]+src="([^"]+\.js)"/g),
    ...html.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="([^"]+)"/g),
  ].map((m) => new URL(m[1]!, base + page).href);
  const inline = [
    ...html.matchAll(/<script(?![^>]*type="application\/json")[^>]*>([\s\S]*?)<\/script>/g),
  ].map((m) => m[1] ?? '');
  const seen = new Set<string>();
  let total = inline.reduce((n, s) => n + gzipSync(s).length, 0);
  while (queue.length) {
    const url = queue.shift()!;
    if (seen.has(url)) continue;
    seen.add(url);
    const js = await text(url);
    total += gzipSync(js).length;
    for (const m of js.matchAll(/(?:import|from)\s*["']([^"']+\.js)["']/g))
      queue.push(new URL(m[1]!, url).href);
  }
  const kb = total / 1024;
  worst = Math.max(worst, kb);
  console.log(`${page.padEnd(32)} ${seen.size} fichier(s) JS · ${kb.toFixed(1)} Ko gzip`);
}
if (worst > BUDGET_KB) {
  console.error(`✗ Budget dépassé : ${worst.toFixed(1)} Ko > ${BUDGET_KB} Ko`);
  process.exit(1);
}
console.log(`✓ Budget respecté (≤ ${BUDGET_KB} Ko gzip)`);
