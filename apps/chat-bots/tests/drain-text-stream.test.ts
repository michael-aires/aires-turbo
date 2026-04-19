import { strict as assert } from "node:assert";
import { before, describe, it } from "node:test";

process.env.REDIS_URL ??= "redis://localhost:6379";
process.env.HARNESS_INTERNAL_URL ??= "http://harness.local";
process.env.CORE_INTERNAL_URL ??= "http://core.local";
process.env.SINGLE_ORG_ID ??= "00000000-0000-0000-0000-000000000000";
process.env.BOT_AGENT_ID ??= "agent_bot";
process.env.BOT_API_KEY ??= "test-api-key-test-api-key-xx";
process.env.BOT_INTERNAL_SECRET ??= "test-internal-secret-xxxxxxxxxx";

type DrainTextStream = (stream: ReadableStream<Uint8Array>) => Promise<string>;
let drainTextStream: DrainTextStream;

before(async () => {
  ({ drainTextStream } = await import("../src/handlers/whatsapp.js"));
});

function streamOf(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let i = 0;
  return new ReadableStream({
    pull(controller) {
      if (i >= chunks.length) {
        controller.close();
        return;
      }
      controller.enqueue(encoder.encode(chunks[i] ?? ""));
      i += 1;
    },
  });
}

describe("drainTextStream (UI message stream SSE)", () => {
  it("concatenates text-delta events into a single string", async () => {
    const stream = streamOf([
      'data: {"type":"text-start","id":"m1"}\n',
      'data: {"type":"text-delta","id":"m1","delta":"Hello"}\n',
      'data: {"type":"text-delta","id":"m1","delta":", world!"}\n',
      'data: {"type":"text-end","id":"m1"}\n',
      "data: [DONE]\n",
    ]);
    assert.equal(await drainTextStream(stream), "Hello, world!");
  });

  it("ignores non-text parts (tool calls, reasoning)", async () => {
    const stream = streamOf([
      'data: {"type":"tool-input-start","toolCallId":"t1"}\n',
      'data: {"type":"text-delta","delta":"ok"}\n',
      'data: {"type":"tool-output-available","toolCallId":"t1","output":{"any":1}}\n',
    ]);
    assert.equal(await drainTextStream(stream), "ok");
  });

  it("handles frames split across chunk boundaries", async () => {
    const stream = streamOf([
      'data: {"type":"text-delta","del',
      'ta":"foo"}\n',
      'data: {"type":"text-delta","delta":"bar"}\n',
    ]);
    assert.equal(await drainTextStream(stream), "foobar");
  });

  it("skips malformed frames without crashing", async () => {
    const stream = streamOf([
      "data: {this is not json}\n",
      'data: {"type":"text-delta","delta":"survived"}\n',
    ]);
    assert.equal(await drainTextStream(stream), "survived");
  });
});
