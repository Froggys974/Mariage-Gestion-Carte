// Compile les points d'entrée Node hors Astro (démarrage, worker, scripts) en bundles ESM.
import { build } from 'esbuild';

const entries = {
  start: 'src/server/start.ts',
  'scripts/worker': 'src/worker/index.ts',
  'scripts/migrate': 'scripts/migrate.ts',
  'scripts/seed': 'scripts/seed.ts',
  'scripts/demo-wedding': 'scripts/demo-wedding.ts',
  'scripts/create-admin-hash': 'scripts/create-admin-hash.ts',
  'scripts/test-mail': 'scripts/test-mail.ts',
  'scripts/purge': 'scripts/purge.ts',
};

await build({
  entryPoints: entries,
  outdir: 'dist',
  outExtension: { '.js': '.mjs' },
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  packages: 'external',
  sourcemap: true,
  tsconfig: 'tsconfig.json',
  logLevel: 'info',
});
