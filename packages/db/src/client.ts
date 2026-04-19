import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

/**
 * Lazy-initialised Postgres pool + Drizzle client.
 *
 * We intentionally do NOT throw on missing DATABASE_URL at module evaluation
 * time. Next.js builds (especially Turbopack "Collecting page data") will
 * otherwise fail at build time for any route that statically imports @acme/db,
 * even when the build environment legitimately has no database configured.
 *
 * The error is still raised eagerly the first time any caller actually touches
 * the `db` export, so runtime misconfiguration surfaces immediately with the
 * same message as before.
 */

type Schema = typeof schema;
type RealDB = ReturnType<typeof drizzle<Schema>>;

let _pool: Pool | undefined;
let _db: RealDB | undefined;

function getDb(): RealDB {
  if (_db) return _db;

  const connectionString =
    process.env.DATABASE_URL ?? process.env.POSTGRES_URL;

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL (or POSTGRES_URL) is required to initialise the Postgres client",
    );
  }

  _pool = new Pool({
    connectionString,
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
  });

  _db = drizzle(_pool, {
    schema,
    casing: "snake_case",
  });

  return _db;
}

export const db = new Proxy({} as RealDB, {
  get(_target, prop, receiver) {
    const client = getDb() as unknown as Record<string | symbol, unknown>;
    const value = client[prop];
    return typeof value === "function"
      ? (value as (...args: unknown[]) => unknown).bind(client)
      : value;
  },
});

export type DBClient = RealDB;
export type DBTransaction = Parameters<DBClient["transaction"]>[0] extends (
  tx: infer T,
  ...args: never[]
) => unknown
  ? T
  : never;
