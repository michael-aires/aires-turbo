import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { pickProvider } from "../src/lib/providers.js";

describe("pickProvider", () => {
  it("falls back to env default when no override + no bot default", () => {
    assert.equal(
      pickProvider({ overrideEnabled: false, envDefault: "claude" }),
      "claude",
    );
  });

  it("uses bot default over env default", () => {
    assert.equal(
      pickProvider({
        overrideEnabled: false,
        botDefault: "gemini",
        envDefault: "claude",
      }),
      "gemini",
    );
  });

  it("respects override when the flag is enabled and value is valid", () => {
    assert.equal(
      pickProvider({
        override: "gpt",
        overrideEnabled: true,
        envDefault: "claude",
      }),
      "gpt",
    );
  });

  it("ignores override when the flag is disabled", () => {
    assert.equal(
      pickProvider({
        override: "gpt",
        overrideEnabled: false,
        envDefault: "claude",
      }),
      "claude",
    );
  });

  it("ignores invalid override values", () => {
    assert.equal(
      pickProvider({
        override: "not-a-provider",
        overrideEnabled: true,
        envDefault: "claude",
      }),
      "claude",
    );
  });
});
