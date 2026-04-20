import { and, desc, eq, or, sql } from "drizzle-orm";
import { z } from "zod/v4";

import { defineTool, toolRegistry } from "@acme/agents";
import { db } from "@acme/db/client";
import { contact } from "@acme/db/schema";
import { EventType, publish } from "@acme/events";

/**
 * LLMs often emit tool arguments in snake_case even when the schema is
 * camelCase (e.g. `first_name` instead of `firstName`). Normalize keys
 * before validation so both shapes work transparently.
 */
function camelize(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const camel = key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
    out[camel] = value;
  }
  return out;
}

const CreateInput = z.preprocess(camelize, z.object({
  email: z.string().email().max(320).optional(),
  phone: z.string().max(32).optional(),
  firstName: z.string().max(128).optional(),
  lastName: z.string().max(128).optional(),
  source: z.string().max(64).optional(),
  status: z.string().max(32).optional(),
  projectId: z.string().uuid().optional(),
  custom: z.record(z.string(), z.unknown()).optional(),
}));

const ContactRow = z.object({
  id: z.string(),
  organizationId: z.string(),
  projectId: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  source: z.string().nullable(),
  status: z.string(),
  createdAt: z.string(),
});

function serialize(row: typeof contact.$inferSelect) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    projectId: row.projectId,
    email: row.email,
    phone: row.phone,
    firstName: row.firstName,
    lastName: row.lastName,
    source: row.source,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  };
}

export const contactCreateTool = defineTool({
  name: "contact.create",
  displayName: "Create CRM contact",
  description:
    "Create a contact in the headless CRM. Scoped to the caller's organization.",
  category: "crm",
  inputSchema: CreateInput,
  outputSchema: ContactRow,
  requiredScopes: ["contact:write"],
  requiresApproval: false,
  costTier: "low",
  async handler({ input, ctx }) {
    const actorId =
      ctx.actor.type === "agent" ? ctx.actor.agentId : ctx.actor.userId;
    const row = await db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(contact)
        .values({
          organizationId: ctx.organizationId,
          projectId: input.projectId ?? null,
          email: input.email,
          phone: input.phone,
          firstName: input.firstName,
          lastName: input.lastName,
          source: input.source,
          status: input.status ?? "new",
          custom: input.custom ?? {},
        })
        .returning();
      if (!inserted) throw new Error("failed to insert contact");

      await publish(tx, {
        organizationId: inserted.organizationId,
        eventType: EventType.ContactCreated,
        aggregateType: "contact",
        aggregateId: inserted.id,
        payload: {
          contactId: inserted.id,
          email: inserted.email ?? undefined,
          phone: inserted.phone ?? undefined,
        },
        actor: { type: ctx.actor.type, id: actorId },
      });

      return inserted;
    });
    return serialize(row);
  },
});

const ListInput = z.preprocess(
  camelize,
  z.object({
    query: z.string().max(256).optional(),
    projectId: z.string().uuid().optional(),
    limit: z.number().int().min(1).max(50).default(10),
  }),
);

export const contactListTool = defineTool({
  name: "contact.list",
  displayName: "List CRM contacts",
  description:
    "List recent contacts in the CRM, optionally filtered by a search query (matches email, first/last name).",
  category: "crm",
  inputSchema: ListInput,
  outputSchema: z.object({
    items: z.array(ContactRow),
    total: z.number().int(),
  }),
  requiredScopes: ["contact:read"],
  requiresApproval: false,
  costTier: "free",
  async handler({ input, ctx }) {
    const filters = [eq(contact.organizationId, ctx.organizationId)];
    if (input.projectId) filters.push(eq(contact.projectId, input.projectId));
    if (input.query) {
      const like = `%${input.query}%`;
      const q = or(
        sql`lower(${contact.email}) like lower(${like})`,
        sql`lower(${contact.firstName}) like lower(${like})`,
        sql`lower(${contact.lastName}) like lower(${like})`,
      );
      if (q) filters.push(q);
    }

    const where = filters.length === 1 ? filters[0] : and(...filters);

    const [rows, [countRow]] = await Promise.all([
      db
        .select()
        .from(contact)
        .where(where)
        .orderBy(desc(contact.createdAt))
        .limit(input.limit),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(contact)
        .where(where),
    ]);

    return {
      items: rows.map(serialize),
      total: countRow?.count ?? 0,
    };
  },
});

const UpdateInput = z.preprocess(
  camelize,
  z.object({
    id: z.string().uuid(),
    email: z.string().email().max(320).optional(),
    phone: z.string().max(32).optional(),
    firstName: z.string().max(128).optional(),
    lastName: z.string().max(128).optional(),
    status: z.string().max(32).optional(),
    source: z.string().max(64).optional(),
  }),
);

export const contactUpdateTool = defineTool({
  name: "contact.update",
  displayName: "Update CRM contact",
  description:
    "Update fields on an existing contact. Only fields you provide are changed; others are preserved.",
  category: "crm",
  inputSchema: UpdateInput,
  outputSchema: ContactRow,
  requiredScopes: ["contact:write"],
  requiresApproval: false,
  costTier: "low",
  async handler({ input, ctx }) {
    const { id, ...patch } = input;
    const [updated] = await db
      .update(contact)
      .set(patch)
      .where(
        and(eq(contact.id, id), eq(contact.organizationId, ctx.organizationId)),
      )
      .returning();
    if (!updated) {
      throw new Error(`contact ${id} not found in this organization`);
    }
    return serialize(updated);
  },
});

export function registerContactTools() {
  toolRegistry.register(contactCreateTool);
  toolRegistry.register(contactListTool);
  toolRegistry.register(contactUpdateTool);
}
