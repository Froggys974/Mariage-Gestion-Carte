/**
 * Génère public/email/noms.png : les noms en Pinyon Script (police auto-hébergée), pour les emails.
 * Usage : pnpm render-names-image "Prénom & Prénom"
 * (Remplacé par l'image dessinée dans l'espace des mariés ; gardé pour mémoire.)
 */
import { mkdirSync, readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const names = process.argv[2];
if (!names) {
  console.error('Indiquez les noms : pnpm render-names-image "Prénom & Prénom"');
  process.exit(2);
}
const [a, b] = names.split('&').map((s) => s.trim());
const font = (f: string) => readFileSync(`node_modules/@fontsource/${f}`).toString('base64');
const html = `<!doctype html><html><head><style>
@font-face{font-family:'Pinyon Script';src:url(data:font/woff2;base64,${font('pinyon-script/files/pinyon-script-latin-400-normal.woff2')}) format('woff2')}
@font-face{font-family:'Cormorant Garamond';font-style:italic;src:url(data:font/woff2;base64,${font('cormorant-garamond/files/cormorant-garamond-latin-400-italic.woff2')}) format('woff2')}
html,body{margin:0;background:transparent}
.n{width:640px;padding:18px 0 22px;text-align:center;font-family:'Pinyon Script';font-size:84px;line-height:1.08;color:#1c3326}
.n span{font-family:'Cormorant Garamond';font-style:italic;color:#a8894a;font-size:.62em}
</style></head><body><div class="n">${a}${b ? `<br><span>&amp;</span><br>${b}` : ''}</div></body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 640, height: 400 }, deviceScaleFactor: 1 });
await page.setContent(html);
await page.evaluate(() => document.fonts.ready);
mkdirSync('public/email', { recursive: true });
await page.locator('.n').screenshot({ path: 'public/email/noms.png', omitBackground: true });
await browser.close();
console.log('✓ public/email/noms.png');
