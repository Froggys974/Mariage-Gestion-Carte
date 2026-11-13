// @ts-check
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import preact from '@astrojs/preact';

const poll = process.env.WATCH_POLL === '1';
// Hors code source : prototypes HTML, rapports de tests et de Lighthouse, builds, données locales.
const notSource = [
  '**/doc/**',
  '**/dist/**',
  '**/data/**',
  '**/test-results/**',
  '**/playwright-report/**',
  '**/.lighthouseci/**',
  '**/coverage/**',
  '**/.pnpm-store/**',
];

export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  // Preact uniquement pour les îlots de l'espace admin : le site invité n'embarque aucun framework.
  integrations: [preact()],
  server: { host: true, port: 4321 },
  // Contrôle d'origine fait dans src/middleware.ts (compatible reverse proxy HTTPS).
  security: { checkOrigin: false },
  // Ni CSS ni JS en ligne : la CSP n'autorise que 'self' + nonce.
  build: { inlineStylesheets: 'never' },
  // Astro 7 passe par défaut à 'jsx' (espaces entre éléments en ligne supprimés) : on garde le rendu d'Astro 5.
  compressHTML: true,
  devToolbar: { enabled: false },
  vite: {
    build: { assetsInlineLimit: 0 },
    // Vite analyse par défaut TOUS les .html du projet (rapports Lighthouse de plusieurs Mo, prototypes) :
    // on limite le pré-bundling au code source, sinon le serveur de dev reste bloqué au démarrage.
    optimizeDeps: { entries: ['src/**/*.{astro,ts,tsx}'] },
    server: {
      // Docker Desktop + WSL2 : les événements de fichiers Windows ne traversent pas le montage, on scrute.
      watch: poll ? { usePolling: true, interval: 300, ignored: notSource } : { ignored: notSource },
    },
  },
});
