import { Hono } from "hono";
import { streamSSE } from "hono/streaming";

import { subscribeBroadcast } from "@acme/events";
import { listUserOrganizationIds } from "@acme/auth/org-resolver";

import { canActorAccessEvent } from "./lib/event-visibility";
import type { CoreHonoEnv } from "./middleware/context";
import { getRequiredActor, requireActor } from "./middleware/context";

export const sseRouter = new Hono<CoreHonoEnv>()
  .use(requireActor)
  .get("/", async (c) => {
    const actor = getRequiredActor(c);
    const userOrganizationIds =
      actor.type === "user"
        ? await listUserOrganizationIds(actor.userId)
        : [];

    return streamSSE(c, async (stream) => {
      const unsub = subscribeBroadcast((envelope) => {
        if (!canActorAccessEvent(actor, envelope, userOrganizationIds)) return;
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
