/**
 * Produit le hash argon2id d'un mot de passe admin, à coller dans .env.
 * Usage : pnpm create-admin-hash            (demande le mot de passe)
 *         pnpm create-admin-hash "motdepasse"
 */
import { createInterface } from 'node:readline';
import { hashPassword, PASSWORD_MIN_LENGTH } from '../src/lib/auth/password';

async function ask(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  return new Promise((resolve) => rl.question(question, (a) => (rl.close(), resolve(a))));
}

const password = process.argv[2] ?? (await ask('Mot de passe admin : '));
if (password.length < PASSWORD_MIN_LENGTH) {
  console.error(`Le mot de passe doit faire au moins ${PASSWORD_MIN_LENGTH} caractères.`);
  process.exit(1);
}
const hash = await hashPassword(password);
console.log('\nCopiez cette ligne dans votre fichier .env (guillemets simples compris) :\n');
console.log(`ADMIN_PASSWORD_HASH='${hash}'\n`);
