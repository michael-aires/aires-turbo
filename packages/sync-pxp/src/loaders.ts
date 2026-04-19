import type { Db } from "mongodb";

import { db } from "@acme/db/client";
import {
  activity,
  contact,
  organization,
  project,
  pxpBootstrapMap,
} from "@acme/db/schema";
import { sql } from "@acme/db";

import { uuidFromMongoId } from "./uuid.js";

export interface LoaderContext {
  mongo: Db;
  organizationId: string;
  dryRun: boolean;
  logger: {
    info: (msg: string, ctx?: Record<string, unknown>) => void;
    warn: (msg: string, ctx?: Record<string, unknown>) => void;
  };
}

export interface LoaderResult {
  entity: string;
  imported: number;
  skipped: number;
  durationMs: number;
}

export async function loadProjects(
  ctx: LoaderContext,
): Promise<LoaderResult> {
  const start = Date.now();
  const cursor = ctx.mongo
    .collection("projects")
    .find({}, { projection: { _id: 1, name: 1, slug: 1 } });
  let imported = 0;
  let skipped = 0;

  for await (const doc of cursor) {
    const pxpId = String(doc._id);
    const pgUuid = uuidFromMongoId("project", pxpId);
    if (ctx.dryRun) {
      imported += 1;
      continue;
    }
    await db
      .insert(project)
      .values({
        id: pgUuid,
        organizationId: ctx.organizationId,
        name: String(doc.name ?? "untitled"),
        slug: String(doc.slug ?? pxpId).slice(0, 128),
        pxpProjectId: pxpId,
      })
      .onConflictDoNothing({ target: project.id });

    await recordMap("project", pxpId, pgUuid);
    imported += 1;
  }

  return {
    entity: "project",
    imported,
    skipped,
    durationMs: Date.now() - start,
  };
}

export async function loadContacts(
  ctx: LoaderContext,
): Promise<LoaderResult> {
  const start = Date.now();
  const cursor = ctx.mongo.collection("contacts").find(
    {},
    {
      projection: {
        _id: 1,
        email: 1,
        phone: 1,
        firstName: 1,
        lastName: 1,
        project: 1,
        source: 1,
        status: 1,
      },
    },
  );
  let imported = 0;
  let skipped = 0;

  for await (const doc of cursor) {
    const pxpId = String(doc._id);
    const pgUuid = uuidFromMongoId("contact", pxpId);
    const projectPgUuid = doc.project
      ? uuidFromMongoId("project", String(doc.project))
      : null;

    if (ctx.dryRun) {
      imported += 1;
      continue;
    }

    await db
      .insert(contact)
      .values({
        id: pgUuid,
        organizationId: ctx.organizationId,
        projectId: projectPgUuid,
        email: doc.email ? String(doc.email).toLowerCase() : null,
        phone: doc.phone ? String(doc.phone) : null,
        firstName: doc.firstName ? String(doc.firstName) : null,
        lastName: doc.lastName ? String(doc.lastName) : null,
        source: doc.source ? String(doc.source) : null,
        status: doc.status ? String(doc.status) : "new",
        pxpContactId: pxpId,
      })
      .onConflictDoNothing({ target: contact.id });

    await recordMap("contact", pxpId, pgUuid);
    imported += 1;
  }

  return {
    entity: "contact",
    imported,
    skipped,
    durationMs: Date.now() - start,
  };
}

export async function loadActivities(
  ctx: LoaderContext,
): Promise<LoaderResult> {
  const start = Date.now();
  const collections = ["activities", "calls", "sms", "activityNotes"];
  let imported = 0;
  let skipped = 0;

  for (const name of collections) {
    const collection = ctx.mongo.collection(name);
    const count = await collection.estimatedDocumentCount();
    if (count === 0) continue;

    const cursor = collection.find({});
    for await (const doc of cursor) {
      const pxpId = String(doc._id);
      const pgUuid = uuidFromMongoId("activity", pxpId);
      const contactPgUuid = doc.contact
        ? uuidFromMongoId("contact", String(doc.contact))
        : null;

      if (ctx.dryRun) {
        imported += 1;
        continue;
      }

      await db
        .insert(activity)
        .values({
          id: pgUuid,
          organizationId: ctx.organizationId,
          contactId: contactPgUuid,
          kind: mapActivityKind(name),
          direction: doc.direction === "inbound" ? "inbound" : "outbound",
          actorType: "system",
          actorId: "pxp-bootstrap",
          occurredAt: doc.createdAt ? new Date(doc.createdAt) : new Date(),
          summary: doc.summary ?? doc.body ?? null,
          payload: doc,
        })
        .onConflictDoNothing({ target: activity.id });

      await recordMap("activity", pxpId, pgUuid);
      imported += 1;
    }
  }

  return {
    entity: "activity",
    imported,
    skipped,
    durationMs: Date.now() - start,
  };
}

export async function ensureDefaultOrg(name: string): Promise<string> {
  const existing = await db
    .select({ id: organization.id })
    .from(organization)
    .limit(1);
  if (existing[0]) return existing[0].id;
  const [row] = await db
    .insert(organization)
    .values({ name, slug: "default" })
    .returning({ id: organization.id });
  if (!row) throw new Error("failed to insert default org");
  return row.id;
}

function mapActivityKind(collection: string) {
  switch (collection) {
    case "calls":
      return "call" as const;
    case "sms":
      return "sms" as const;
    case "activityNotes":
      return "note" as const;
    default:
      return "note" as const;
  }
}

async function recordMap(
  entityType: string,
  mongoId: string,
  pgUuid: string,
): Promise<void> {
  await db
    .insert(pxpBootstrapMap)
    .values({
      entityType,
      pxpMongoId: mongoId,
      postgresUuid: pgUuid,
    })
    .onConflictDoNothing({
      target: [pxpBootstrapMap.entityType, pxpBootstrapMap.pxpMongoId],
    });
  void sql;
}
