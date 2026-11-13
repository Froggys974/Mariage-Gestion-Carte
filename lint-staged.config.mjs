// Contrôles avant commit (husky → lint-staged) sur les fichiers indexés.
// Les fichiers sont passés par paquets de 40 : sous Windows, une ligne de commande est limitée à
// ~8 000 caractères (« La ligne de commande est trop longue » sur un gros commit).
const CHUNK = 40;

const chunks = (files) =>
  Array.from({ length: Math.ceil(files.length / CHUNK) }, (_, i) => files.slice(i * CHUNK, (i + 1) * CHUNK));
const run = (cmd) => (files) => chunks(files).map((c) => `${cmd} ${c.map((f) => `"${f}"`).join(' ')}`);

export default {
  '*.{ts,tsx,js,mjs,astro}': (files) => [...run('eslint --fix')(files), ...run('prettier --write')(files)],
  '*.{css,json,md,yml,yaml}': run('prettier --write'),
};
