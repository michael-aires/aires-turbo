import { z } from "zod/v4";

/**
 * Canonical event catalog. Every event published through the outbox MUST match
 * one of these schemas — the `publish()` helper enforces it. Adding a new
 * event requires a new `z.object()` and a new enum member below.
 */

export const EventEnvelope = z.object({
  id: z.string().uuid(),
  type: z.string(),
  organizationId: z.string().uuid(),
  aggregateType: z.string(),
  aggregateId: z.string(),
  createdAt: z.string(),
  payload: z.record(z.string(), z.unknown()),
  actor: z.object({
    type: z.enum(["user", "agent", "system"]),
    id: z.string(),
  }),
});

export type EventEnvelope = z.infer<typeof EventEnvelope>;

// Canonical event type names — keep in sync with subscription filters.
export const EventType = {
  ContactCreated: "contact.created",
  ContactUpdated: "contact.updated",
  ActivityLogged: "activity.logged",
  EmailSent: "email.sent",
  TaskCreated: "task.created",
  AgentRunStarted: "agent_run.started",
  AgentRunCompleted: "agent_run.completed",
  ApprovalRequested: "approval.requested",
} as const;

export type EventType = (typeof EventType)[keyof typeof EventType];

export const ContactCreatedPayload = z.object({
  contactId: z.string().uuid(),
  email: z.string().optional(),
  phone: z.string().optional(),
});

export const ActivityLoggedPayload = z.object({
  activityId: z.string().uuid(),
  contactId: z.string().uuid().optional(),
  kind: z.string(),
});

export const EmailSentPayload = z.object({
  messageId: z.string(),
  to: z.string(),
  subject: z.string().optional(),
});

export const AgentRunCompletedPayload = z.object({
  agentRunId: z.string().uuid(),
  agentId: z.string().uuid(),
  tool: z.string(),
  status: z.enum(["succeeded", "failed", "cancelled"]),
  costCents: z.number(),
});

export const payloadSchemaForEvent: Record<EventType, z.ZodTypeAny> = {
  [EventType.ContactCreated]: ContactCreatedPayload,
  [EventType.ContactUpdated]: ContactCreatedPayload,
  [EventType.ActivityLogged]: ActivityLoggedPayload,
  [EventType.EmailSent]: EmailSentPayload,
  [EventType.TaskCreated]: z.object({ taskId: z.string().uuid() }),
  [EventType.AgentRunStarted]: z.object({
    agentRunId: z.string().uuid(),
    agentId: z.string().uuid(),
    tool: z.string(),
  }),
  [EventType.AgentRunCompleted]: AgentRunCompletedPayload,
  [EventType.ApprovalRequested]: z.object({
    approvalId: z.string().uuid(),
    agentRunId: z.string().uuid(),
  }),
};
