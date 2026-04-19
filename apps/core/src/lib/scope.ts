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
  const held = new Set(actor.scopes.flatMap(expandScopeAliases));
  if (held.has("tools:*")) return true;

  return required.every((scope) =>
    expandScopeAliases(scope).some(
      (candidate) =>
        held.has(candidate) ||
        held.has(`${candidate.split(":")[0]}:*`),
    ),
  );
}

function expandScopeAliases(scope: string): string[] {
  const explicitAliases = scopeAliases.get(scope) ?? [];
  const [category, action] = scope.split(":");
  if (!category || !action) return [scope, ...explicitAliases];

  const aliases = scopeCategoryAliases.get(category) ?? [];
  return [
    ...new Set([
      scope,
      ...explicitAliases,
      ...[category, ...aliases].map((name) => `${name}:${action}`),
    ]),
  ];
}

const scopeCategoryAliases = new Map<string, string[]>([
  ["contract", ["contracts"]],
  ["contracts", ["contract"]],
  ["report", ["reports"]],
  ["reports", ["report"]],
  ["kb", []],
]);

const scopeAliases = new Map<string, string[]>([
  ["report:fetch", ["reports:read"]],
  ["reports:read", ["report:fetch"]],
  ["kb:search", ["kb:read"]],
  ["kb:read", ["kb:search"]],
]);
