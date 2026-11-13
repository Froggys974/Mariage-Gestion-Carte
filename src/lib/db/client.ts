/** Connexion PostgreSQL (postgres.js + Drizzle). Créée à la première utilisation. */
import postgres from 'postgres';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { getEnv } from '../env';
import * as schema from './schema';

export type Db = PostgresJsDatabase<typeof schema>;
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
/** Base ou transaction : les services acceptent l'une ou l'autre. */
export type DbOrTx = Db | Tx;

interface Holder {
  sql?: postgres.Sql;
  db?: Db;
}
// Survit au rechargement à chaud en développement.
const holder = ((globalThis as Record<string, unknown>).__rcgnDb ??= {}) as Holder;

export function getSql(): postgres.Sql {
  holder.sql ??= postgres(getEnv().DATABASE_URL, {
    max: 10,
    onnotice: () => {},
    connection: { TimeZone: 'UTC' },
  });
  return holder.sql;
}

export function getDb(): Db {
  holder.db ??= drizzle(getSql(), { schema });
  return holder.db;
}

export async function closeDb(): Promise<void> {
  await holder.sql?.end({ timeout: 5 });
  holder.sql = undefined;
  holder.db = undefined;
}

export { schema };
