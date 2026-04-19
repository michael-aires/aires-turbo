/**
 * Seed a developer-facing user + org + default agent so you can actually
 * sign in to apps/chat-web.
 *
 * Run against a locally-booted core (or against a Railway-deployed core
 * if you port-forward / tunnel):
 *
 *   pnpm -F @acme/core dev                # in another terminal
 *   CORE_URL=http://localhost:4000 \
 *   SEED_EMAIL=michael@aires.ai \
 *   SEED_PASSWORD=ChangeMe!23 \
 *   SEED_NAME="Michael Moll" \
 *   SEED_ORG_NAME="Aires" \
 *   pnpm -F @acme/core tsx scripts/seed-dev-user.ts
 *
 * It is idempotent: if the user/org/agent already exist it reuses them
 * and rewrites nothing. At the end it prints the env vars you need to
 * paste into your root `.env` or into Railway (`SINGLE_ORG_ID` and
 * `DEFAULT_AGENT_ID`).
 */

import { eq } from "drizzle-orm";

import { db } from "@acme/db/client";
import {
  agent,
  member,
  organization,
  user as userTable,
} from "@acme/db/schema";
import { createLogger } from "@acme/observability";

const logger = createLogger("seed-dev-user");

const CORE = process.env.CORE_URL ?? "http://localhost:4000";
const EMAIL = process.env.SEED_EMAIL ?? "michael@aires.ai";
const PASSWORD = process.env.SEED_PASSWORD;
const NAME = process.env.SEED_NAME ?? "Michael Moll";
const ORG_NAME = process.env.SEED_ORG_NAME ?? "Aires";
const ORG_SLUG =
  process.env.SEED_ORG_SLUG ??
  (ORG_NAME.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") ||
    "aires");
const AGENT_NAME = process.env.SEED_AGENT_NAME ?? "Aires Default Agent";

if (!PASSWORD) {
  console.error(
    "SEED_PASSWORD is required. Example:\n" +
      '  SEED_PASSWORD="ChangeMe!23" pnpm -F @acme/core tsx scripts/seed-dev-user.ts',
  );
  process.exit(1);
}

async function signUpOrSignIn(): Promise<void> {
  const existing = await db
    .select({ id: userTable.id })
    .from(userTable)
    .where(eq(userTable.email, EMAIL))
    .limit(1);
  if (existing.length > 0) {
    logger.info({ email: EMAIL }, "seed.user.already-exists");
    return;
  }

  const res = await fetch(`${CORE}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD, name: NAME }),
  });
  if (!res.ok) {
    throw new Error(`sign-up failed: ${res.status.toString()} ${await res.text()}`);
  }
  logger.info({ email: EMAIL }, "seed.user.created");
}

async function resolveUserId(): Promise<string> {
  const rows = await db
    .select({ id: userTable.id })
    .from(userTable)
    .where(eq(userTable.email, EMAIL))
    .limit(1);
  const id = rows[0]?.id;
  if (!id) throw new Error(`user not persisted for ${EMAIL}`);
  return id;
}

async function ensureOrg(userId: string): Promise<string> {
  const existing = await db
    .select({ id: organization.id })
    .from(organization)
    .where(eq(organization.slug, ORG_SLUG))
    .limit(1);

  const orgId =
    existing[0]?.id ??
    (
      await db
        .insert(organization)
        .values({ name: ORG_NAME, slug: ORG_SLUG })
        .returning({ id: organization.id })
    )[0]!.id;

  const existingMember = await db
    .select({ id: member.id })
    .from(member)
    .where(eq(member.userId, userId))
    .limit(1);
  if (existingMember.length === 0) {
    await db
      .insert(member)
      .values({ organizationId: orgId, userId, role: "owner" });
  }
  return orgId;
}

async function ensureAgent(
  orgId: string,
  userId: string,
): Promise<string> {
  const existing = await db
    .select({ id: agent.id })
    .from(agent)
    .where(eq(agent.organizationId, orgId))
    .limit(1);
  if (existing[0]?.id) return existing[0].id;

  const row = await db
    .insert(agent)
    .values({
      organizationId: orgId,
      ownerUserId: userId,
      name: AGENT_NAME,
      scopes: ["tools:*"],
    })
    .returning({ id: agent.id });
  return row[0]!.id;
}

async function main() {
  logger.info({ core: CORE, email: EMAIL, orgSlug: ORG_SLUG }, "seed.start");

  await signUpOrSignIn();
  const userId = await resolveUserId();
  const orgId = await ensureOrg(userId);
  const agentId = await ensureAgent(orgId, userId);

  logger.info({ userId, orgId, agentId }, "seed.success");

  console.log("\n────────────────────────────────────────────────");
  console.log("Seed complete. Paste into your .env (root) or Railway:\n");
  console.log(`SINGLE_ORG_ID=${orgId}`);
  console.log(`DEFAULT_AGENT_ID=${agentId}`);
  console.log(`\nSign in at:    http://localhost:3100/login`);
  console.log(`Email:         ${EMAIL}`);
  console.log(`Password:      (the SEED_PASSWORD you provided)`);
  console.log("────────────────────────────────────────────────\n");
}

main().catch((err) => {
  logger.error(
    { err: err instanceof Error ? err.message : String(err) },
    "seed.failed",
  );
  process.exit(1);
});
