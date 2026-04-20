import { Queue } from "bullmq";
import { Redis as IORedis } from "ioredis";
import { z } from "zod/v4";

import { defineTool, toolRegistry, writeAudit } from "@acme/agents";
import type { ActorContext } from "@acme/auth";

import { env } from "../env";

/**
 * `email.send` — first reference tool.
 *
 * The core service enqueues the job; `apps/workers` runs the SendGrid call.
 * Returning the job id lets agents correlate later webhook delivery events.
 */
const connection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

const emailQueue = new Queue("email", { connection });

/**
 * LLMs emit a variety of field names for message contents: `body`, `content`,
 * `message`, and occasionally snake_case variants. We normalise anything that
 * maps to a plain-text payload onto `text` so the worker always has something
 * to send — and we require at least one of text/html at the end via refine.
 */
function normalizeEmailInput(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const obj = raw as Record<string, unknown>;
  const out: Record<string, unknown> = { ...obj };
  const textAliases = ["body", "content", "message", "plainText", "plain_text"];
  if (!out.text) {
    for (const key of textAliases) {
      if (typeof obj[key] === "string" && (obj[key] as string).length > 0) {
        out.text = obj[key];
        delete out[key];
        break;
      }
    }
  }
  if (!out.html && typeof obj.body_html === "string") {
    out.html = obj.body_html;
    delete out.body_html;
  }
  return out;
}

const Input = z.preprocess(
  normalizeEmailInput,
  z
    .object({
      to: z.union([z.string().email(), z.array(z.string().email())]),
      subject: z.string().min(1).max(256),
      text: z.string().optional(),
      html: z.string().optional(),
      from: z.string().email().optional(),
      contactId: z.string().uuid().optional(),
    })
    .refine((v) => Boolean(v.text || v.html), {
      message: "Provide either `text` or `html` content for the email body.",
      path: ["text"],
    }),
);

const Output = z.object({
  jobId: z.string(),
  queued: z.literal(true),
});

function actorKey(actor: ActorContext): { type: "user" | "agent"; id: string } {
  return actor.type === "agent"
    ? { type: "agent", id: actor.agentId }
    : { type: "user", id: actor.userId };
}

export const emailSendTool = defineTool({
  name: "email.send",
  displayName: "Send email",
  description:
    "Queue an outbound transactional email. Provide `to`, `subject`, and at " +
    "least one of `text` (plain text body) or `html` (HTML body). Returns a " +
    "jobId — delivery is asynchronous via the workers service.",
  category: "communication",
  inputSchema: Input,
  outputSchema: Output,
  requiredScopes: ["email:send"],
  requiresApproval: false,
  costTier: "low",
  async handler({ input, ctx }) {
    const job = await emailQueue.add("send", {
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
      from: input.from,
      contactId: input.contactId,
      organizationId: ctx.organizationId,
      enqueuedBy: actorKey(ctx.actor),
      requestId: ctx.requestId,
    });
    await writeAudit(ctx, {
      tool: "email.send",
      action: "email.send",
      args: input,
      result: "ok",
      metadata: { jobId: job.id },
    });
    return { jobId: job.id ?? "unknown", queued: true as const };
  },
});

export function registerEmailSendTool() {
  toolRegistry.register(emailSendTool);
}
