/**
 * Regression guard for the outbox + webhook-delivery claim protocol.
 *
 * Without a live Postgres we cannot actually exercise concurrent claims, but
 * we can pin the SQL invariants that make the protocol correct. If any of
 * these strings disappear the build fails — flagging the very audit finding
 * we just fixed (Critical 3: non-atomic selection race).
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

const outboxSource = readFileSync(
  fileURLToPath(
    new URL(
      "../../../packages/events/src/outbox.ts",
      import.meta.url,
    ),
  ),
  "utf8",
);

const webhookSource = readFileSync(
  fileURLToPath(
    new URL(
      "../../../packages/events/src/webhook-delivery.ts",
      import.meta.url,
    ),
  ),
  "utf8",
);

describe("outbox dispatcher claim semantics", () => {
  it("uses SELECT ... FOR UPDATE SKIP LOCKED to claim rows atomically", () => {
    assert.match(outboxSource, /for update skip locked/i);
  });

  it("filters unpublished rows and respects an expired-claim TTL", () => {
    assert.match(outboxSource, /published_at is null/i);
    assert.match(outboxSource, /claimed_at is null\s+or claimed_at <\s+now/i);
  });

  it("stamps consumer identity on claim (claimed_at + claimed_by)", () => {
    assert.match(outboxSource, /set claimed_at = now\(\)/i);
    assert.match(outboxSource, /claimed_by = \$\{options\.consumerId\}/);
  });

  it("scopes success/failure updates to the claiming consumer", () => {
    assert.match(outboxSource, /claimed_by = \$\{options\.consumerId\}/);
    const successUpdate = outboxSource.indexOf("publishedAt: sql`now()`");
    assert.ok(successUpdate > 0, "expected a success update block");
  });
});

describe("webhook delivery claim semantics", () => {
  it("uses SELECT ... FOR UPDATE SKIP LOCKED in claimNextDelivery", () => {
    assert.match(webhookSource, /for update skip locked/i);
  });

  it("respects next_retry_at gating on pending rows", () => {
    assert.match(webhookSource, /wd\.status = 'pending'/);
    assert.match(
      webhookSource,
      /wd\.next_retry_at is null or wd\.next_retry_at <= now/i,
    );
  });

  it("fanOut uses ON CONFLICT DO NOTHING on (subscriptionId, outboxEventId)", () => {
    assert.match(webhookSource, /onConflictDoNothing/);
    assert.match(
      webhookSource,
      /target:\s*\[\s*webhookDelivery\.subscriptionId,\s*webhookDelivery\.outboxEventId\s*\]/,
    );
  });

  it("gates status updates on the claim stamp to prevent cross-worker writes", () => {
    // Both the success path and the failure path must filter on claimedBy.
    const claimedByFilterCount = (
      webhookSource.match(/eq\(webhookDelivery\.claimedBy, options\.consumerId\)/g) ?? []
    ).length;
    assert.ok(
      claimedByFilterCount >= 2,
      `expected both success and failure update paths to filter on claimedBy, got ${claimedByFilterCount}`,
    );
  });
});
