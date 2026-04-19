import type { ActorContext } from "@acme/auth";
import type { EventEnvelope } from "@acme/events";

export function canActorAccessEvent(
  actor: ActorContext,
  envelope: EventEnvelope,
  userOrganizationIds: string[] = [],
): boolean {
  if (actor.type === "agent") {
    if (actor.orgId !== envelope.organizationId) return false;

    if (actor.projectIds.length === 0) return true;
    const projectId = readProjectId(envelope);
    return !projectId || actor.projectIds.includes(projectId);
  }

  const allowedOrgIds = actor.orgId ? [actor.orgId] : userOrganizationIds;
  return allowedOrgIds.includes(envelope.organizationId);
}

function readProjectId(envelope: EventEnvelope): string | undefined {
  const payload = envelope.payload as { projectId?: unknown };
  return typeof payload.projectId === "string" ? payload.projectId : undefined;
}
