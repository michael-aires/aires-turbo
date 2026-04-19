import type { ActorContext } from "@acme/auth";

/**
 * Scope gate for tool invocation.
 *
 * Human users (session-authenticated) are trusted. Agent actors must hold
 * every required scope literally, or a matching wildcard (`tools:*` as a
 * super-scope, or `<category>:*` per tool family).
 */
export function hasScope(actor: ActorContext, required: string[]): boolean {
  if (actor.type !== "agent") return true;
  const held = actor.scopes;
  if (held.includes("tools:*")) return true;
  return required.every(
    (r) => held.includes(r) || held.includes(`${r.split(":")[0]}:*`),
  );
}
