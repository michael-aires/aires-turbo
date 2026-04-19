/**
 * Phase 1 smoke: prove the agent identity plane end-to-end.
 *
 *   sign-up human user  ->  create org + membership  ->  create agent
 *   ->  mint agent JWT  ->  call /api/v1/whoami as the agent
 *   ->  assert the audit row exists with actorType = "agent".
 *
 * Run against a locally-booted core:
 *
 *   pnpm -F @acme/core dev
 *   pnpm -F @acme/core tsx scripts/phase1-smoke.ts
 */

import { and, desc, eq } from "drizzle-orm";

import { db } from "@acme/db/client";
import {
  agent,
  auditLog,
  member,
  organization,
  user as userTable,
} from "@acme/db/schema";
import { createLogger } from "@acme/observability";

const logger = createLogger("phase1-smoke");

const CORE = process.env.CORE_URL ?? "http://localhost:4000";
const EMAIL = `smoke+${Date.now()}@aires.tech`;
const PASSWORD = "smoke-password-123!";

async function signUp(): Promise<string> {
  const res = await fetch(`${CORE}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD, name: "Smoke" }),
  });
  if (!res.ok) {
    throw new Error(`sign-up failed: ${res.status} ${await res.text()}`);
  }
  const cookie = res.headers.get("set-cookie");
  if (!cookie) throw new Error("no session cookie returned");
  return cookie;
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

async function ensureOrgAndAgent(
  userId: string,
): Promise<{ orgId: string; agentId: string }> {
  const orgRow = await db
    .insert(organization)
    .values({ name: "Smoke Org", slug: `smoke-${Date.now()}` })
    .returning();
  const orgId = orgRow[0]!.id;

  await db.insert(member).values({
    organizationId: orgId,
    userId,
    role: "owner",
  });

  const agentRow = await db
    .insert(agent)
    .values({
      organizationId: orgId,
      ownerUserId: userId,
      name: "Smoke Agent",
      scopes: ["tools:*"],
    })
    .returning();

  return { orgId, agentId: agentRow[0]!.id };
}

async function mintAgentToken(
  cookie: string,
  agentId: string,
): Promise<string> {
  const res = await fetch(`${CORE}/api/v1/agents/${agentId}/tokens`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({}),
  });
  if (!res.ok) {
    throw new Error(`mint failed: ${res.status} ${await res.text()}`);
  }
  const body = (await res.json()) as { token: string };
  return body.token;
}

async function callAsAgent(token: string): Promise<number> {
  const res = await fetch(`${CORE}/api/v1/whoami`, {
    headers: { authorization: `Bearer ${token}` },
  });
  return res.status;
}

async function findAuditRow(agentId: string) {
  const rows = await db
    .select()
    .from(auditLog)
    .where(and(eq(auditLog.actorType, "agent"), eq(auditLog.actorId, agentId)))
    .orderBy(desc(auditLog.createdAt))
    .limit(1);
  return rows[0];
}

async function main() {
  logger.info({ email: EMAIL }, "smoke.start");
  const cookie = await signUp();
  const userId = await resolveUserId();
  const { orgId, agentId } = await ensureOrgAndAgent(userId);
  logger.info({ orgId, agentId, userId }, "smoke.agent.created");

  const token = await mintAgentToken(cookie, agentId);
  logger.info({ tokenPrefix: token.slice(0, 12) }, "smoke.token.minted");

  const status = await callAsAgent(token);
  logger.info({ status }, "smoke.agent.call");
  if (status !== 200) throw new Error(`whoami returned ${status}`);

  // Audit writes happen after the response returns — give it a beat.
  await new Promise((r) => setTimeout(r, 250));
  const audit = await findAuditRow(agentId);
  if (!audit) throw new Error("no audit row written for agent");

  logger.info(
    { auditId: audit.id, action: audit.action, result: audit.result },
    "smoke.success",
  );
}

main().catch((err) => {
  logger.error({ err: err instanceof Error ? err.message : String(err) }, "smoke.failed");
  process.exit(1);
});
