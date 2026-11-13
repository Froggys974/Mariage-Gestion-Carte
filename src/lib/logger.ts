/**
 * Journaux structurés (JSON) sans données personnelles.
 * Les tokens d'invitation ne doivent jamais apparaître : utiliser scrubPath() pour toute URL.
 */
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  base: { service: process.env.SERVICE_NAME ?? 'app' },
  redact: {
    paths: [
      'token',
      '*.token',
      'email',
      '*.email',
      'phone',
      '*.phone',
      'password',
      '*.password',
      'code',
      '*.code',
      'headers.cookie',
      'headers.authorization',
    ],
    censor: '[masqué]',
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

const TOKEN_PATHS: Array<[RegExp, string]> = [
  [/^\/i\/[^/?#]+/, '/i/:token'],
  [/^\/api\/rsvp\/[^/?#]+/, '/api/rsvp/:token'],
];

/** Retire les tokens et la query string d'un chemin avant de le journaliser. */
export function scrubPath(pathname: string): string {
  let p = pathname.split('?')[0] ?? '';
  for (const [re, rep] of TOKEN_PATHS) p = p.replace(re, rep);
  return p;
}
