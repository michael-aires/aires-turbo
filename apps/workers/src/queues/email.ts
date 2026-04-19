import { Worker } from "bullmq";

import { db } from "@acme/db/client";
import { activity, communication } from "@acme/db/schema";
import { EventType, publish } from "@acme/events";
import { SendGridAdapter } from "@acme/integrations";
import { createLogger } from "@acme/observability";

import { connection } from "../connection";
import { env } from "../env";

const logger = createLogger("worker.email");

export interface EmailJob {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  from?: string;
  contactId?: string;
  organizationId?: string;
  enqueuedBy: { type: "agent" | "user" | "system"; id: string };
  requestId: string;
}

export function startEmailWorker() {
  if (!env.SENDGRID_API_KEY) {
    logger.warn({
      reason: "SENDGRID_API_KEY missing",
    }, "email.worker.disabled");
    return undefined;
  }

  const adapter = new SendGridAdapter({
    apiKey: env.SENDGRID_API_KEY,
    defaultFrom: env.SENDGRID_FROM_EMAIL,
  });

  const worker = new Worker<EmailJob>(
    "email",
    async (job) => {
      const start = Date.now();
      const result = await adapter.send({
        to: job.data.to,
        subject: job.data.subject,
        text: job.data.text,
        html: job.data.html,
        from: job.data.from,
      });

      if (job.data.contactId && job.data.organizationId) {
        await recordActivityAndEvent(job.data, result.messageId);
      }

      logger.info({
        operation: "email.worker.send",
        jobId: job.id,
        durationMs: Date.now() - start,
        messageId: result.messageId,
      }, "email.sent");
    },
    { connection, concurrency: 8 },
  );

  worker.on("failed", (job, err) => {
    if (!job) {
      logger.error({
        operation: "email.worker.send",
        error: err.message,
      }, "email.failed_without_job");
      return;
    }

    logger.error({
      operation: "email.worker.send",
      jobId: job.id,
      error: err.message,
      attempts: job.attemptsMade,
    }, "email.failed");
  });

  return worker;
}

async function recordActivityAndEvent(
  data: EmailJob,
  messageId: string,
): Promise<void> {
  const organizationId = data.organizationId;
  if (!organizationId) return;

  await db.transaction(async (tx) => {
    const [act] = await tx
      .insert(activity)
      .values({
        organizationId,
        contactId: data.contactId,
        kind: "email",
        direction: "outbound",
        actorType: data.enqueuedBy.type,
        actorId: data.enqueuedBy.id,
        summary: data.subject,
      })
      .returning();

    if (!act) return;

    await tx.insert(communication).values({
      activityId: act.id,
      provider: "sendgrid",
      externalId: messageId,
      subject: data.subject,
      body: data.html ?? data.text ?? "",
      status: "sent",
    });

    await publish(tx, {
      organizationId,
      eventType: EventType.EmailSent,
      aggregateType: "email",
      aggregateId: messageId,
      payload: {
        messageId,
        to: Array.isArray(data.to) ? data.to.join(",") : data.to,
        subject: data.subject,
      },
      actor: data.enqueuedBy,
    });
  });
}
