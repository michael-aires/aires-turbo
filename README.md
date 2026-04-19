# Aires Headless CRM

A headless, multi-tenant CRM built for **AI agents first, humans second**.

This is a ground-up rebuild of the Aires PXP CRM as a Postgres + Drizzle +
Better-Auth stack, deployed as microservices on Railway. Agents identify via
short-lived JWTs (15m, scoped, revocable), call a versioned REST surface, and
leave an immutable audit trail. Humans get the same data through a Next.js
admin app over tRPC.

---

## Architecture

```
                 ┌────────────────────────────────────────────────────┐
                 │  Agent caller  (Claude / OpenAI / MCP / CLI)       │
                 └────────────────────┬───────────────────────────────┘
                                      │  Bearer <agent jwt>
                                      ▼
   ┌────────────────────────────────────────────────────────────────┐
   │  apps/core     Hono + Better-Auth + tRPC (synchronous API)     │
   │  ├── /api/auth/*         Better-Auth (sessions, api keys, jwt) │
   │  ├── /api/v1/whoami      actor introspection                   │
   │  ├── /api/v1/contacts    CRM entities                          │
   │  ├── /api/v1/tools/:name typed tool invocation (scoped+audited)│
   │  ├── /api/v1/events      SSE live stream                       │
   │  └── /api/v1/agents/:id/tokens  JWT mint                       │
   └───────┬─────────────────────────────┬──────────────────────────┘
           │                             │
           │ BullMQ jobs                 │ Redis Streams (event bus)
           ▼                             ▼
   ┌─────────────────┐           ┌───────────────────────────────────┐
   │ apps/workers    │           │  apps/mcp-server                  │
   │ SendGrid        │           │  MCP SSE + tool catalog proxy     │
   │ Aircall         │           │  (surface for Claude Desktop etc.)│
   │ DocuSeal        │           └───────────────────────────────────┘
   │ Blackline       │
   │ outbox dispatch │
   │ webhook deliver │
   └─────────────────┘

           ┌──────────────────────────────────────────────┐
           │  Postgres (core data + pgvector RAG)         │
           │  Redis    (streams + BullMQ + rate limits)   │
           └──────────────────────────────────────────────┘
```

Three deployable services, one monorepo, one shared package layer.

| Service             | Purpose                                                      | Port |
| ------------------- | ------------------------------------------------------------ | ---- |
| `apps/core`         | Synchronous REST + tRPC, Better-Auth, SSE, tool invocation   | 4000 |
| `apps/workers`      | BullMQ workers for integrations, outbox + webhook dispatch   | 4100 |
| `apps/mcp-server`   | Model Context Protocol SSE transport for external AI clients | 4200 |
| `apps/nextjs`       | Admin UI (contacts, webhooks, audit, tools)                  | 3000 |

---

## Package layout

```
packages/
  auth/           Better-Auth init + org resolver + agent JWT verification
  db/             Drizzle schema (identity, crm, events, agents, rag, sync)
  api/            tRPC routers (contact, activity, task, agent, tool, audit…)
  events/         Outbox, Redis Streams, webhook delivery
  agents/         Tool registry, approvals, rate limit, audit helpers
  rag/            pgvector embeddings, hybrid search, agent memory
  integrations/   SendGrid / Aircall / DocuSeal / Blackline adapters
  observability/  Pino logger + OpenTelemetry bootstrap
  sync-pxp/       One-time CLI to bootstrap from PXP Mongo → Postgres
  validators/     Shared Zod schemas (ported from template)
```

No file in the new code exceeds 500 lines. Every service has an env schema
validated at boot. Every tool invocation is scope-checked, rate-limited, and
audited.

---

## Quick start (local)

### 1. Prerequisites

- Node.js 22.21+ (`nvm use 22`)
- pnpm 10
- Postgres 15+ with `pgvector` extension
- Redis 7+

### 2. Install & configure

```bash
pnpm install
cp .env.example .env
# edit .env — at minimum: POSTGRES_URL, REDIS_URL, BETTER_AUTH_SECRET
```

### 3. Push the schema

```bash
pnpm -F @acme/db push
```

### 4. Boot services

```bash
pnpm -F @acme/core dev        # http://localhost:4000
pnpm -F @acme/workers dev     # BullMQ workers
pnpm -F @acme/mcp-server dev  # MCP SSE on :4200 (optional)
pnpm -F @acme/nextjs dev      # Admin UI on :3000
```

### 5. Smoke-test the identity plane

```bash
pnpm -F @acme/core tsx scripts/phase1-smoke.ts
```

You should see a successful agent JWT mint, a 200 on `/api/v1/whoami`, and
a fresh row in `audit_log` with `actor_type = 'agent'`.

### 6. Run the unit tests

```bash
pnpm -F @acme/core test
```

---

## Key concepts

### Actors

Every request resolves to a typed `ActorContext`:

- `{ type: "user", userId, sessionId, orgId? }` — Better-Auth session cookie
- `{ type: "agent", agentId, tokenId, scopes, projectIds, orgId? }` — agent JWT

Middleware attaches the actor, `requireActor` gates protected routes, and the
shared `resolveOrgId()` in `@acme/auth/org-resolver` handles per-user org
caching.

### Scopes

Agents hold scopes like `email:send`, `contract:send`, `kb:search`, `memory:*`.
The `hasScope()` gate supports literal matches, per-category wildcards
(`email:*`), and a super-scope (`tools:*`). Unit tests for the gate live at
`apps/core/tests/scope.test.ts`.

### JWT revocation

Agent JWTs are 15 minutes. Every verified token is also checked against the
`agent_token` table (by `jti`) and the agent's `status`. Revoking a token
or disabling an agent takes effect on the next call — not when the JWT
expires.

### Tool invocation

`POST /api/v1/tools/:name` is the single agent-facing entry point. Each call:

1. Resolves the actor's `organizationId`.
2. Checks `hasScope` against the tool's `requiredScopes`.
3. For agent actors, hits a per-tool rate limiter (Redis, 60 req/min).
4. Validates input against the tool's Zod schema.
5. For high-impact tools (e.g. `contract.send`), opens an `agent_run` row
   and requests a human approval before executing.
6. Writes an `audit_log` row on success, denial, or error.

Catalog and in-memory registry are exposed over tRPC (`tool.catalog`,
`tool.inMemory`) for the admin UI and MCP server — but **execution never
goes through tRPC**, only through the authenticated REST adapter.

### Event bus

- **Outbox** (`packages/events/src/outbox.ts`) — writes inside a txn, drained
  to Redis Streams by `apps/workers`.
- **Redis Streams** — durable, consumer-grouped fan-out.
- **Webhook delivery** (`packages/events/src/webhook-delivery.ts`) — signed,
  retried, surfaced in the admin UI.
- **SSE** — live tail at `/api/v1/events` for dashboards.

### RAG

`packages/rag` wraps pgvector. `kb.search` is tenant-isolated — the
`organizationId` comes from the actor context, never from the tool input.

---

## Deployment (Railway)

See `docs/HEADLESS_CRM_QUICKSTART.md`. Each `apps/*` ships a `railway.json`
with a Nixpacks build. Provision:

- Railway Postgres plugin (enable `pgvector` via `CREATE EXTENSION`)
- Railway Redis plugin
- Three services: `core`, `workers`, `mcp-server`
- Shared env vars set at the project level, service-specific ones on each

---

## Documentation

- `docs/HEADLESS_CRM_QUICKSTART.md` — local + Railway walkthrough
- `docs/CLAUDE_DESKTOP_MCP.md` — wiring Claude Desktop → `apps/mcp-server`

---

## Project status

Core identity, CRM minimum, event bus, email/SMS/contract/report tools,
approvals plane, audit dashboard, RAG, MCP server, and PXP bootstrap CLI
are all implemented. See the phase tracker in the docs for what's next.
