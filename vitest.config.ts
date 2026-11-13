import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: { alias: { '~': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    // les tests d'intégration partagent une base : pas de parallélisme entre fichiers
    fileParallelism: false,
    env: { NODE_ENV: 'test' },
  },
});
