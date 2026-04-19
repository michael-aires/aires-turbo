import { strict as assert } from "node:assert";
import { before, describe, it } from "node:test";

// env.ts validates at import time; set required vars before dynamic import.
process.env.REDIS_URL ??= "redis://localhost:6379";
process.env.CORE_INTERNAL_URL ??= "http://core.local";
process.env.MCP_SERVER_URL ??= "http://mcp.local";
process.env.SINGLE_ORG_ID ??= "00000000-0000-0000-0000-000000000000";
process.env.BETTER_AUTH_SECRET ??= "test-secret-test-secret-test-secret-xx";

type DeriveTitle = (raw: string) => string;
let deriveTitle: DeriveTitle;

before(async () => {
  ({ deriveTitle } = await import("../src/runs/thread-index.js"));
});

describe("deriveTitle", () => {
  it("returns the message as-is when under 60 chars", () => {
    assert.equal(deriveTitle("hello world"), "hello world");
  });

  it("trims whitespace and collapses runs", () => {
    assert.equal(deriveTitle("  hello   world  "), "hello world");
  });

  it("truncates and appends ellipsis past 60 chars", () => {
    const long = "a".repeat(80);
    const result = deriveTitle(long);
    assert.ok(result.endsWith("…"));
    assert.ok(result.length <= 60);
  });

  it("falls back to a default for empty input", () => {
    assert.equal(deriveTitle(""), "New thread");
    assert.equal(deriveTitle("   "), "New thread");
  });
});
