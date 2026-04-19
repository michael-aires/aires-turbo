import type { ActorContext } from "@acme/auth";

export interface ToolProjectScopeResult {
  projectId?: string;
  error?: "forbidden";
}

export function resolveToolProjectScope(
  actor: ActorContext,
  input: unknown,
): ToolProjectScopeResult {
  const requestedProjectId = readProjectId(input);
  if (actor.type !== "agent") {
    return { projectId: requestedProjectId };
  }

  if (actor.projectIds.length === 0) {
    return { projectId: requestedProjectId };
  }

  if (requestedProjectId) {
    return actor.projectIds.includes(requestedProjectId)
      ? { projectId: requestedProjectId }
      : { error: "forbidden" };
  }

  if (actor.projectIds.length === 1) {
    return { projectId: actor.projectIds[0] };
  }

  return {};
}

function readProjectId(input: unknown): string | undefined {
  if (!input || typeof input !== "object") return undefined;
  const candidate = (input as { projectId?: unknown }).projectId;
  return typeof candidate === "string" ? candidate : undefined;
}
