/**
 * Cross-tenant authorization gate. Proves `assertOrganizationAccess`,
 * `assertRowOrganizationAccess`, `requireUserId`, and
 * `listAuthorizedOrganizationIds` honour the `member` table and throw the
 * right tRPC error codes. Uses a chainable query stub — no live Postgres.
 */

import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { TRPCError } from "@trpc/server";

import {
  assertOrganizationAccess,
  assertRowOrganizationAccess,
  listAuthorizedOrganizationIds,
  requireUserId,
} from "@acme/api/authz";

const USER_A = "11111111-1111-1111-1111-111111111111";
const ORG_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const ORG_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

/**
 * Build a thenable query stub that returns `rows` regardless of what query
 * builder chain is applied. Captures the final `where` predicate so callers
 * that want to assert tenant filtering can inspect it.
 */
function makeDbStub(rows: { organizationId: string }[]) {
  const last: { whereArgs: unknown[] } = { whereArgs: [] };
  const chain = new Proxy(
    {},
    {
      get(_target, prop: string | symbol) {
        if (prop === "then") {
          return (
            onFulfilled: (value: unknown) => unknown,
            onRejected?: (reason: unknown) => unknown,
          ) => Promise.resolve(rows).then(onFulfilled, onRejected);
        }
        if (prop === "where") {
          return (...args: unknown[]) => {
            last.whereArgs = args;
            return chain;
          };
        }
        return () => chain;
      },
    },
  );
  return { db: chain as never, last };
}

function ctxFor(userId: string | null, rows: { organizationId: string }[]) {
  const { db } = makeDbStub(rows);
  return {
    db,
    session: userId ? { user: { id: userId } } : null,
  };
}

describe("requireUserId", () => {
  it("throws UNAUTHORIZED when session is missing", () => {
    const ctx = ctxFor(null, []);
    assert.throws(
      () => requireUserId(ctx),
      (err) => err instanceof TRPCError && err.code === "UNAUTHORIZED",
    );
  });

  it("returns the user id when session is present", () => {
    const ctx = ctxFor(USER_A, []);
    assert.equal(requireUserId(ctx), USER_A);
  });
});

describe("listAuthorizedOrganizationIds", () => {
  it("returns the org ids of every membership row", async () => {
    const ctx = ctxFor(USER_A, [
      { organizationId: ORG_A },
      { organizationId: ORG_B },
    ]);
    const ids = await listAuthorizedOrganizationIds(ctx);
    assert.deepEqual(ids.sort(), [ORG_A, ORG_B].sort());
  });

  it("throws UNAUTHORIZED when there is no session", async () => {
    const ctx = ctxFor(null, []);
    await assert.rejects(
      () => listAuthorizedOrganizationIds(ctx),
      (err) => err instanceof TRPCError && err.code === "UNAUTHORIZED",
    );
  });
});

describe("assertOrganizationAccess", () => {
  it("allows access when the user has a membership in the org", async () => {
    const ctx = ctxFor(USER_A, [{ organizationId: ORG_A }]);
    await assert.doesNotReject(() => assertOrganizationAccess(ctx, ORG_A));
  });

  it("throws FORBIDDEN when the membership query returns zero rows", async () => {
    const ctx = ctxFor(USER_A, []);
    await assert.rejects(
      () => assertOrganizationAccess(ctx, ORG_B),
      (err) => err instanceof TRPCError && err.code === "FORBIDDEN",
    );
  });

  it("throws UNAUTHORIZED when the session is missing", async () => {
    const ctx = ctxFor(null, [{ organizationId: ORG_A }]);
    await assert.rejects(
      () => assertOrganizationAccess(ctx, ORG_A),
      (err) => err instanceof TRPCError && err.code === "UNAUTHORIZED",
    );
  });
});

describe("assertRowOrganizationAccess", () => {
  it("throws NOT_FOUND when the row has no organizationId", async () => {
    const ctx = ctxFor(USER_A, [{ organizationId: ORG_A }]);
    await assert.rejects(
      () => assertRowOrganizationAccess(ctx, null),
      (err) => err instanceof TRPCError && err.code === "NOT_FOUND",
    );
    await assert.rejects(
      () => assertRowOrganizationAccess(ctx, undefined),
      (err) => err instanceof TRPCError && err.code === "NOT_FOUND",
    );
  });

  it("throws FORBIDDEN when the row's org is outside the user's memberships", async () => {
    const ctx = ctxFor(USER_A, []);
    await assert.rejects(
      () => assertRowOrganizationAccess(ctx, ORG_B),
      (err) => err instanceof TRPCError && err.code === "FORBIDDEN",
    );
  });

  it("allows access when the row's org matches a membership", async () => {
    const ctx = ctxFor(USER_A, [{ organizationId: ORG_A }]);
    await assert.doesNotReject(() => assertRowOrganizationAccess(ctx, ORG_A));
  });
});
