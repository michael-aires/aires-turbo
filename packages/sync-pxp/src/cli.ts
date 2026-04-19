#!/usr/bin/env tsx
import { MongoClient } from "mongodb";

import { createLogger } from "@acme/observability";

import {
  ensureDefaultOrg,
  loadActivities,
  loadContacts,
  loadProjects,
} from "./loaders.js";

const logger = createLogger("sync-pxp");

async function main() {
  const [, , command] = process.argv;
  if (command !== "bootstrap") {
    console.log("usage: aires-bootstrap bootstrap [--dry-run]");
    process.exit(1);
  }

  const dryRun = process.argv.includes("--dry-run");

  const mongoUrl = process.env.PXP_MONGO_URL ?? process.env.MONGODB_URI;
  if (!mongoUrl) {
    logger.error("PXP_MONGO_URL is required for bootstrap");
    process.exit(1);
  }

  const client = await MongoClient.connect(mongoUrl, {
    readPreference: "secondaryPreferred",
  });
  const mongo = client.db();

  try {
    const organizationId = await ensureDefaultOrg(
      process.env.DEFAULT_ORG_NAME ?? "Aires",
    );
    const ctx = { mongo, organizationId, dryRun, logger };

    logger.info({ dryRun, organizationId }, "bootstrap.start");

    const results = [];
    results.push(await loadProjects(ctx));
    results.push(await loadContacts(ctx));
    results.push(await loadActivities(ctx));

    logger.info({ results }, "bootstrap.complete");
  } finally {
    await client.close();
  }
}

main().catch((err: unknown) => {
  logger.error({ error: String(err) }, "bootstrap.failed");
  process.exit(1);
});
