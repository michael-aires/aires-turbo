import { index, pgTable, uniqueIndex } from "drizzle-orm/pg-core";

export const pxpBootstrapMap = pgTable(
  "pxp_bootstrap_map",
  (t) => ({
    id: t.uuid().primaryKey().defaultRandom(),
    entityType: t.varchar({ length: 64 }).notNull(),
    pxpMongoId: t.text().notNull(),
    postgresUuid: t.uuid().notNull(),
    importedAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),
  }),
  (table) => [
    uniqueIndex("pxp_map_type_id_uniq").on(
      table.entityType,
      table.pxpMongoId,
    ),
    index("pxp_map_pg_idx").on(table.postgresUuid),
  ],
);
