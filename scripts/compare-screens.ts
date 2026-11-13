/**
 * Outil de relecture : capture le prototype (doc/design) et le site avec les mêmes paramètres d'URL,
 * puis assemble les deux côte à côte (prototype à gauche, production à droite).
 *
 * Usage : pnpm compare [filtre] [--out dossier] [--base http://localhost:4321] [--token <token>]
 */
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';
import sharp from 'sharp';

interface Case {
  name: string;
  proto: string;
  ours: string;
  width: number;
  height: number;
  wait?: number;
  /** action avant capture (ex. ouvrir l'onglet) */
  admin?: boolean;
}

const args = process.argv.slice(2);
const opt = (k: string, d: string) => {
  const i = args.indexOf(k);
  return i >= 0 && args[i + 1] ? args[i + 1]! : d;
};
const filter = args.find((a) => !a.startsWith('--') && args[args.indexOf(a) - 1]?.startsWith('--') !== true);
const out = resolve(opt('--out', 'test-results/compare'));
const base = opt('--base', 'http://localhost:4321');
const token = opt('--token', 'ODpIYKP2La9V6XE0plvjVA');
const FP = pathToFileURL(resolve('doc/design/Faire-part v3.dc.html')).href;
const TB = pathToFileURL(resolve('doc/design/Tableau de bord.dc.html')).href;

const M = { width: 390, height: 844 };
const D = { width: 1440, height: 900 };
const CASES: Case[] = [
  { name: 'M2-accueil', proto: `${FP}?intro=0&scene=0&i=a7k2x9`, ours: `/i/${token}?intro=0&scene=0`, ...M },
  {
    name: 'M3-fairepart',
    proto: `${FP}?intro=0&scene=1&i=a7k2x9`,
    ours: `/i/${token}?intro=0&scene=1`,
    ...M,
  },
  {
    name: 'M4-ouvert',
    proto: `${FP}?intro=0&scene=1&open=1&i=a7k2x9`,
    ours: `/i/${token}?intro=0&scene=1&open=1`,
    ...M,
    wait: 4200,
  },
  { name: 'M5-table', proto: `${FP}?intro=0&scene=2&i=a7k2x9`, ours: `/i/${token}?intro=0&scene=3`, ...M },
  {
    name: 'M6-chaise',
    proto: `${FP}?intro=0&scene=2&sheet=1&i=a7k2x9`,
    ours: `/i/${token}?intro=0&scene=3&sheet=1`,
    ...M,
  },
  { name: 'M7-dresscode', proto: `${FP}?intro=0&scene=3`, ours: `/?intro=0&scene=4`, ...M },
  { name: 'M8-contact', proto: `${FP}?intro=0&scene=4`, ours: `/?intro=0&scene=5`, ...M },
  { name: 'M9-menu', proto: `${FP}?intro=0&scene=0&menu=1`, ours: `/?intro=0&scene=0&menu=1`, ...M },
  { name: 'M1-intro', proto: `${FP}`, ours: `/?introtest=1`, ...M, wait: 1600 },
  { name: 'D1-accueil', proto: `${FP}?intro=0&scene=0`, ours: `/?intro=0&scene=0`, ...D },
  { name: 'D3-table', proto: `${FP}?intro=0&scene=2&i=a7k2x9`, ours: `/i/${token}?intro=0&scene=3`, ...D },
  { name: 'M10-admin', proto: TB, ours: '/admin', ...M, admin: true },
  { name: 'D4-admin', proto: TB, ours: '/admin', ...D, admin: true },
  { name: 'D5-admin-carte', proto: `${TB}?tab=card`, ours: '/admin?tab=card', ...D, admin: true },
  { name: 'D6-admin-plan', proto: `${TB}?tab=plan`, ours: '/admin?tab=plan', ...D, admin: true },
];

async function main(): Promise<void> {
  mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  const adminState = resolve('e2e/.auth/admin.json');
  for (const c of CASES.filter((x) => !filter || x.name.includes(filter))) {
    const shots: Buffer[] = [];
    for (const which of ['proto', 'ours'] as const) {
      const context = await browser.newContext({
        viewport: { width: c.width, height: c.height },
        deviceScaleFactor: 1,
        ...(which === 'ours' && c.admin ? { storageState: adminState } : {}),
      });
      const page = await context.newPage();
      const url = which === 'proto' ? c.proto : base + c.ours;
      await page.goto(url, { waitUntil: 'networkidle' }).catch(() => undefined);
      await page.waitForTimeout(c.wait ?? 2600);
      shots.push(await page.screenshot());
      await context.close();
    }
    const [a, b] = shots as [Buffer, Buffer];
    await sharp({ create: { width: c.width * 2 + 16, height: c.height, channels: 3, background: '#ff00ff' } })
      .composite([
        { input: a, left: 0, top: 0 },
        { input: b, left: c.width + 16, top: 0 },
      ])
      .png()
      .toFile(resolve(out, `${c.name}.png`));
    console.log(`✓ ${c.name}`);
  }
  await browser.close();
  console.log(`Captures dans ${out}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
