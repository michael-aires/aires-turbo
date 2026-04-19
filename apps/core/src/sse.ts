import { Hono } from "hono";
import { streamSSE } from "hono/streaming";

import { subscribeBroadcast } from "@acme/events";

import type { CoreHonoEnv } from "./middleware/context.js";
import { requireActor } from "./middleware/context.js";

export const sseRouter = new Hono<CoreHonoEnv>()
  .use(requireActor)
  .get("/events", (c) => {
    return streamSSE(c, async (stream) => {
      const unsub = subscribeBroadcast((envelope) => {
        void stream.writeSSE({
          id: envelope.id,
          event: envelope.type,
          data: JSON.stringify(envelope),
        });
      });
      c.req.raw.signal.addEventListener("abort", unsub);
      await new Promise<void>((resolve) => {
        c.req.raw.signal.addEventListener("abort", () => resolve());
      });
    });
  });
