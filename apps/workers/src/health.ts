import { createServer } from "node:http";

import { createLogger } from "@acme/observability";

import { env } from "./env";

const logger = createLogger("worker.health");

/**
 * Minimal HTTP health endpoint so Railway can verify the workers container
 * is actually alive (BullMQ is TCP-only; we still want `/healthz`).
 */
export function startHealthServer() {
  const server = createServer((req, res) => {
    if (req.url === "/healthz" || req.url === "/readyz") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
      return;
    }
    res.writeHead(404).end();
  });

  server.listen(env.PORT, () => {
    logger.info({ operation: "workers.boot", port: env.PORT }, "health ready");
  });

  return server;
}
