#!/usr/bin/env node
// Tests unitaires + tests d'intégration sur la base jetable du conteneur de dev (docker compose up -d db).
// Fonctionne aussi sous Windows (pas de « VAR=x commande » dans les scripts pnpm).
import { spawn } from 'node:child_process';

const env = {
  ...process.env,
  TEST_DATABASE_URL:
    process.env.TEST_DATABASE_URL ?? 'postgres://mariage:mariage@localhost:5434/mariage_test',
};
const child = spawn(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', ...process.argv.slice(2)], {
  env,
  stdio: 'inherit',
});
child.on('exit', (code, signal) => process.exit(signal ? 1 : (code ?? 1)));
