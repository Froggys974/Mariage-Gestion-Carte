#!/usr/bin/env node
// Lance un script de maintenance : TypeScript (tsx) en développement, bundle compilé en production.
// Usage : node scripts/run.mjs <migrate|seed|demo-wedding|worker|create-admin-hash|test-mail> [args...]
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';

const SOURCES = {
  migrate: 'scripts/migrate.ts',
  seed: 'scripts/seed.ts',
  'demo-wedding': 'scripts/demo-wedding.ts',
  worker: 'src/worker/index.ts',
  'create-admin-hash': 'scripts/create-admin-hash.ts',
  'test-mail': 'scripts/test-mail.ts',
  purge: 'scripts/purge.ts',
};

const [name, ...args] = process.argv.slice(2);
if (!name || !(name in SOURCES)) {
  console.error(`Script inconnu « ${name ?? ''} ». Choix : ${Object.keys(SOURCES).join(', ')}`);
  process.exit(2);
}
const bundled = `dist/scripts/${name}.mjs`;
const useBundle = process.env.NODE_ENV === 'production' || !existsSync(SOURCES[name]);
const nodeArgs = useBundle ? [bundled, ...args] : ['--import', 'tsx', SOURCES[name], ...args];
const child = spawn(process.execPath, nodeArgs, { stdio: 'inherit' });
child.on('exit', (code, signal) => process.exit(signal ? 1 : (code ?? 1)));
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => child.kill(sig));
