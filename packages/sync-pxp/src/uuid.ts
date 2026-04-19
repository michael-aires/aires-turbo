import { createHash } from "node:crypto";

/**
 * Deterministic UUID v5-style derivation from a PXP Mongo `_id`. Same input
 * always produces the same Postgres UUID, so the bootstrap CLI is safe to
 * re-run without duplicating rows.
 */
export function uuidFromMongoId(
  entityType: string,
  mongoId: string,
): string {
  const hash = createHash("sha1")
    .update(`aires/${entityType}/${mongoId}`)
    .digest("hex");

  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    "5" + hash.slice(13, 16),
    "a" + hash.slice(17, 20),
    hash.slice(20, 32),
  ].join("-");
}
