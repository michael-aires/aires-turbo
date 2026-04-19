import { serve } from "@hono/node-server";
import { trpcServer } from "@hono/trpc-server";
import { Hono } from "hono";
import { cors } from "hono/cors";

import { appRouter, createTRPCContext } from "@acme/api";
import { createLogger, startTelemetry } from "@acme/observability";

import { agentTokensRouter } from "./agent-tokens.js";
import { auth } from "./auth.js";
import { env } from "./env.js";
import { auditRequest } from "./middleware/audit.js";
import { authContext } from "./middleware/context.js";
import type { CoreHonoEnv } from "./middleware/context.js";
import { contactRest } from "./rest/contact.js";
import { toolRest } from "./rest/tool.js";
import { sseRouter } from "./sse.js";
import { registerAllTools } from "./tools/index.js";

startTelemetry("aires-core");
const logger = createLogger("aires-core");

const app = new Hono<CoreHonoEnv>();

app.use(
  "*",
  cors({
    origin: (origin) => origin ?? "*",
    allowHeaders: ["authorization", "content-type", "x-api-key", "x-request-id"],
    allowMethods: ["GET", "POST", "OPTIONS", "PUT", "PATCH", "DELETE"],
    credentials: true,
  }),
);
app.use("*", authContext);
app.use("*", auditRequest);

// --- liveness & readiness --------------------------------------------------
app.get("/healthz", (c) => c.json({ ok: true }));
app.get("/readyz", (c) => c.json({ ok: true }));

// --- Better-Auth catch-all -------------------------------------------------
app.all("/api/auth/*", (c) => auth.handler(c.req.raw));

// --- tRPC ------------------------------------------------------------------
app.use(
  "/api/trpc/*",
  trpcServer({
    router: appRouter,
    createContext: async ({ req }) =>
      createTRPCContext({ headers: req.headers, auth }),
  }),
);

// --- REST v1 ---------------------------------------------------------------
const v1 = new Hono<CoreHonoEnv>();
v1.get("/whoami", (c) => {
  const actor = c.get("actor");
  if (!actor) return c.json({ error: "unauthenticated" }, 401);
  return c.json({ actor, requestId: c.get("requestId") });
});
v1.route("/contacts", contactRest);
v1.route("/tools", toolRest);
v1.route("/agents", agentTokensRouter);
app.route("/api/v1", v1);

// --- SSE -------------------------------------------------------------------
app.route("/events", sseRouter);

async function start() {
  await registerAllTools();
  const server = serve({ fetch: app.fetch, port: env.PORT }, (info) => {
    logger.info({ operation: "core.boot", port: info.port }, "core listening");
  });
  const shutdown = () => server.close(() => process.exit(0));
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

void start();

export type CoreApp = typeof app;
