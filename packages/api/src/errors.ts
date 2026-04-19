import { TRPCError } from "@trpc/server";

export class AgentForbiddenError extends TRPCError {
  constructor(scope: string) {
    super({
      code: "FORBIDDEN",
      message: `agent is missing required scope: ${scope}`,
    });
  }
}

export class RateLimitedError extends TRPCError {
  constructor(tool: string) {
    super({
      code: "TOO_MANY_REQUESTS",
      message: `rate limit exceeded for ${tool}`,
    });
  }
}

export class ApprovalRequiredError extends TRPCError {
  constructor(runId: string) {
    super({
      code: "FORBIDDEN",
      message: `tool requires approval; run ${runId} is waiting`,
      cause: { runId, reason: "approval-required" },
    });
  }
}
