import { serve } from "@hono/node-server";
import { trpcServer } from "@hono/trpc-server";
import { Hono } from "hono";
import { cors } from "hono/cors";

import { appRouter, createTRPCContext } from "@acme/api";
import { createLogger, startTelemetry } from "@acme/observability";

import { agentTokensRouter } from "./agent-tokens";
import { auth } from "./auth";
import { env } from "./env";
import { auditRequest } from "./middleware/audit";
import { authContext } from "./middleware/context";
import type { CoreHonoEnv } from "./middleware/context";
import { chatThreadsRest } from "./rest/chat-threads";
import { contactRest } from "./rest/contact";
import { toolRest } from "./rest/tool";
import { sseRouter } from "./sse";
import { registerAllTools } from "./tools/index";
import { whatsappWebhookRouter } from "./webhooks/whatsapp";

startTelemetry("aires-core");
const logger = createLogger("aires-core");
const allowedOrigins = buildAllowedOrigins();

const app = new Hono<CoreHonoEnv>();

app.use(
  "*",
  cors({
    origin: (origin) => {
      if (!origin) return undefined;
      return allowedOrigins.has(origin) ? origin : undefined;
    },
    allowHeaders: [
      "authorization",
      "content-type",
      "x-api-key",
      "x-request-id",
      "x-organization-id",
    ],
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
v1.route("/chat-threads", chatThreadsRest);
app.route("/api/v1", v1);

// --- SSE -------------------------------------------------------------------
app.route("/events", sseRouter);

// --- Public webhooks (verified before any work) ----------------------------
app.route("/", whatsappWebhookRouter);

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

function buildAllowedOrigins(): Set<string> {
  const origins = new Set<string>();

  try {
    origins.add(new URL(env.CORE_PUBLIC_URL).origin);
  } catch {
    // env validation already guards this; keep the helper total.
  }

  for (const rawOrigin of env.CORS_ALLOWED_ORIGINS?.split(",") ?? []) {
    const origin = rawOrigin.trim();
    if (origin) origins.add(origin);
  }

  if (env.NODE_ENV !== "production") {
    origins.add("http://localhost:3000");
    origins.add("http://127.0.0.1:3000");
    origins.add("http://localhost:4000");
    origins.add("http://127.0.0.1:4000");
  }

  return origins;
}
