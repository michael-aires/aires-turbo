import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import type { Redis } from "ioredis";

import { createChatSessions } from "./chat-sessions.js";

/**
 * Tiny in-memory stand-in for the subset of ioredis commands chat-sessions
 * actually uses: rpush, ltrim, lrange, del. Keeps tests hermetic.
 */
function makeMemoryKv(): Redis {
  const store = new Map<string, string[]>();

  const api = {
    // Implementations are sync over in-memory state but Promises are returned
    // so callers `await` like the real client.
    rpush(key: string, value: string): Promise<number> {
      const list = store.get(key) ?? [];
      list.push(value);
      store.set(key, list);
      return Promise.resolve(list.length);
    },
    ltrim(key: string, start: number, stop: number): Promise<"OK"> {
      const list = store.get(key);
      if (!list) return Promise.resolve("OK");
      const len = list.length;
      const s = start < 0 ? Math.max(0, len + start) : Math.min(start, len);
      const e = stop < 0 ? len + stop : Math.min(stop, len - 1);
      store.set(key, list.slice(s, e + 1));
      return Promise.resolve("OK");
    },
    lrange(key: string, start: number, stop: number): Promise<string[]> {
      const list = store.get(key) ?? [];
      const len = list.length;
      const s = start < 0 ? Math.max(0, len + start) : Math.min(start, len);
      const e = stop < 0 ? len + stop + 1 : Math.min(stop + 1, len);
      return Promise.resolve(list.slice(s, e));
    },
    del(key: string): Promise<number> {
      const existed = store.has(key) ? 1 : 0;
      store.delete(key);
      return Promise.resolve(existed);
    },
  };

  return api as unknown as Redis;
}

describe("chat-sessions", () => {
  it("appends and reads messages in order", async () => {
    const sessions = createChatSessions({ kv: makeMemoryKv() });
    await sessions.append("thread-1", {
      role: "user",
      content: "hi",
      createdAt: new Date("2026-04-18T10:00:00Z").toISOString(),
    });
    await sessions.append("thread-1", {
      role: "assistant",
      content: "hello",
      createdAt: new Date("2026-04-18T10:00:01Z").toISOString(),
    });

    const msgs = await sessions.read("thread-1");
    assert.equal(msgs.length, 2);
    const first = msgs[0];
    const second = msgs[1];
    assert.ok(first && second);
    assert.equal(first.role, "user");
    assert.equal(second.role, "assistant");
  });

  it("caps the thread at maxMessages (ring buffer)", async () => {
    const sessions = createChatSessions({ kv: makeMemoryKv(), maxMessages: 3 });
    for (let i = 0; i < 5; i++) {
      await sessions.append("thread-cap", {
        role: "user",
        content: `msg-${i}`,
        createdAt: new Date().toISOString(),
      });
    }
    const msgs = await sessions.read("thread-cap");
    assert.equal(msgs.length, 3);
    const first = msgs[0];
    const last = msgs[msgs.length - 1];
    assert.ok(first && last);
    assert.equal(first.content, "msg-2");
    assert.equal(last.content, "msg-4");
  });

  it("rejects invalid threadId", async () => {
    const sessions = createChatSessions({ kv: makeMemoryKv() });
    await assert.rejects(
      async () =>
        sessions.append("", {
          role: "user",
          content: "hi",
          createdAt: new Date().toISOString(),
        }),
      /threadId/,
    );
  });

  it("clear wipes the thread", async () => {
    const sessions = createChatSessions({ kv: makeMemoryKv() });
    await sessions.append("thread-x", {
      role: "user",
      content: "hello",
      createdAt: new Date().toISOString(),
    });
    await sessions.clear("thread-x");
    const msgs = await sessions.read("thread-x");
    assert.equal(msgs.length, 0);
  });
});
