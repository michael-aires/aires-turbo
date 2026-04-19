import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { z } from "zod/v4";

import { createLogger } from "@acme/observability";

import { fetchToolCatalog, invokeTool } from "./core-client.js";
import { env } from "./env.js";

const logger = createLogger("aires-mcp");

const transports = new Map<string, SSEServerTransport>();

/**
 * Build an MCP server instance and lazy-mount every tool advertised by
 * `core`'s catalog. One server per SSE session so tool execution is scoped
 * to the agent JWT the client connected with.
 */
async function buildServer(agentJwt: string): Promise<McpServer> {
  const catalog = await fetchToolCatalog().catch((err) => {
    logger.error({ error: String(err) }, "catalog.fetch.failed");
    return [];
  });

  const server = new McpServer({
    name: "aires-crm",
    version: "0.1.0",
  });

  for (const entry of catalog) {
    server.tool(
      entry.name,
      entry.description,
      { input: z.record(z.string(), z.unknown()) },
      async ({ input }) => {
        const result = await invokeTool({
          agentJwt,
          toolName: entry.name,
          input,
          requestId: randomUUID(),
        });
        return {
          content: [{ type: "text", text: JSON.stringify(result) }],
        };
      },
    );
  }

  return server;
}

const httpServer = createServer((req, res) => {
  void handleRequest(req, res);
});

async function handleRequest(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);

  if (url.pathname === "/healthz" || url.pathname === "/readyz") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (req.method === "GET" && url.pathname === "/sse") {
    const auth = req.headers.authorization?.replace(/^Bearer\s+/, "");
    const agentJwt = auth ?? "";
    if (!agentJwt) {
      res.writeHead(401).end('{"error":"agent token required"}');
      return;
    }
    const transport = new SSEServerTransport("/message", res);
    transports.set(transport.sessionId, transport);
    res.on("close", () => transports.delete(transport.sessionId));
    const server = await buildServer(agentJwt);
    await server.connect(transport);
    return;
  }

  if (req.method === "POST" && url.pathname === "/message") {
    const sessionId = url.searchParams.get("sessionId");
    if (!sessionId) {
      res.writeHead(400).end('{"error":"sessionId query param required"}');
      return;
    }
    const transport = transports.get(sessionId);
    if (!transport) {
      res.writeHead(404).end('{"error":"unknown session"}');
      return;
    }
    await transport.handlePostMessage(req, res);
    return;
  }

  res.writeHead(404).end();
}

httpServer.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, "mcp.boot");
});

const shutdown = () => httpServer.close(() => process.exit(0));
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
