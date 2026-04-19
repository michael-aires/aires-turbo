import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

const connectionString =
  process.env.DATABASE_URL ?? process.env.POSTGRES_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL (or POSTGRES_URL) is required to initialise the Postgres client",
  );
}

const pool = new Pool({
  connectionString,
  max: Number(process.env.DATABASE_POOL_MAX ?? 10),
});

export const db = drizzle(pool, {
  schema,
  casing: "snake_case",
});

export type DBClient = typeof db;
export type DBTransaction = Parameters<DBClient["transaction"]>[0] extends (
  tx: infer T,
  ...args: never[]
) => unknown
  ? T
  : never;
