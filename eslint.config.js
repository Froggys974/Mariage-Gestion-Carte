import { defineConfig } from 'eslint/config';
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import astro from 'eslint-plugin-astro';
import globals from 'globals';

export default defineConfig(
  {
    ignores: [
      'dist/**',
      '.astro/**',
      'node_modules/**',
      '.pnpm-store/**',
      'doc/**',
      '.claude/**',
      'drizzle/**',
      'playwright-report/**',
      'test-results/**',
      '.lighthouseci/**',
      'coverage/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...astro.configs.recommended,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-irregular-whitespace': ['error', { skipStrings: true, skipComments: true, skipTemplates: true }],
    },
  },
  {
    files: ['scripts/**', 'e2e/**'],
    rules: { 'no-console': 'off' },
  },
);
