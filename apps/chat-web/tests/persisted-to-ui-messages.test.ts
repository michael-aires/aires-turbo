import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import type { PersistedMessage } from "../src/lib/persisted-to-ui-messages.js";
import { persistedToUIMessages } from "../src/lib/persisted-to-ui-messages.js";

const iso = "2026-04-18T12:00:00.000Z";

describe("persistedToUIMessages", () => {
  it("returns an empty array for empty input", () => {
    assert.deepEqual(persistedToUIMessages("th_1", []), []);
  });

  it("drops system and tool messages, keeping user/assistant", () => {
    const input: PersistedMessage[] = [
      { role: "system", content: "hidden", createdAt: iso },
      { role: "user", content: "hi", createdAt: iso },
      { role: "tool", content: "tool chatter", createdAt: iso },
      { role: "assistant", content: "hello", createdAt: iso },
    ];
    const out = persistedToUIMessages("th_1", input);
    assert.equal(out.length, 2);
    assert.equal(out[0]?.role, "user");
    assert.equal(out[1]?.role, "assistant");
  });

  it("shapes each message as a single text part with a stable id", () => {
    const out = persistedToUIMessages("th_abc", [
      { role: "user", content: "hi", createdAt: iso },
      { role: "assistant", content: "hello", createdAt: iso },
    ]);
    assert.equal(out[0]?.id, "th_abc-0");
    assert.equal(out[1]?.id, "th_abc-1");
    const firstPart = out[0]?.parts[0];
    assert.ok(firstPart && firstPart.type === "text");
    if (firstPart.type === "text") {
      assert.equal(firstPart.text, "hi");
    }
  });
});
