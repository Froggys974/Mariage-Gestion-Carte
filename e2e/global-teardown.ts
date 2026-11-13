/** Arrête le worker démarré par global-setup. */
import { existsSync, readFileSync, rmSync } from 'node:fs';

export default async function globalTeardown(): Promise<void> {
  const file = 'test-results/.worker-pid';
  if (!existsSync(file)) return;
  const pid = Number(readFileSync(file, 'utf8'));
  if (pid) {
    try {
      process.kill(pid);
    } catch {
      /* déjà arrêté */
    }
  }
  rmSync(file, { force: true });
}
