import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { deriveToolCallState } from "../src/components/tool-call-state.js";

describe("deriveToolCallState", () => {
  it("maps output-available to ok", () => {
    assert.equal(deriveToolCallState("output-available"), "ok");
  });

  it("maps output-error to error", () => {
    assert.equal(deriveToolCallState("output-error"), "error");
  });

  it("treats input-streaming as running", () => {
    assert.equal(deriveToolCallState("input-streaming"), "running");
  });

  it("treats input-available as running", () => {
    assert.equal(deriveToolCallState("input-available"), "running");
  });

  it("treats unknown/missing state as running", () => {
    assert.equal(deriveToolCallState(undefined), "running");
    assert.equal(deriveToolCallState(null), "running");
    assert.equal(deriveToolCallState("something-else"), "running");
  });
});
