import { Hono } from "hono";

import { CreateContactSchema } from "@acme/db/schema";

import type { CoreHonoEnv } from "../middleware/context";
import { requireActor } from "../middleware/context";
import { appCaller } from "../trpc-caller";

/**
 * Thin REST adapter over the tRPC router — keeps REST and tRPC in sync by
 * delegation rather than copy-paste.
 */
export const contactRest = new Hono<CoreHonoEnv>()
  .use(requireActor)
  .get("/", async (c) => {
    const organizationId = c.req.query("organizationId");
    if (!organizationId) return c.json({ error: "organizationId required" }, 400);
    const caller = await appCaller(c);
    const result = await caller.contact.list({ organizationId });
    return c.json(result);
  })
  .post("/", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as unknown;
    const parsed = CreateContactSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "validation", issues: parsed.error.issues }, 400);
    }
    const caller = await appCaller(c);
    const row = await caller.contact.create(parsed.data);
    return c.json(row, 201);
  });
