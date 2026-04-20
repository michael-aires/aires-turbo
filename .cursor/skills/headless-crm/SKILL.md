---
name: aires-headless-crm
description: >-
  Agent-first control plane for the Aires headless CRM (aires-turbo). Describes
  every tool, primitive, and convention an AI agent or Cursor developer needs
  to use or extend the Postgres + Drizzle + Hono + Better-Auth + BullMQ + MCP
  stack that replaces pxp-server for agent-driven real-estate CRM work.
  Trigger on "headless crm", "aires agent tool", "aires-turbo", "mint agent
  token", "call a CRM tool", "MCP tool for Aires", "add a headless CRM tool",
  "add an aires-turbo route", "email.send tool", "contract.send approval",
  "kb.search", "memory.remember", "agent JWT", "agent scopes", "agent audit",
  or any intent to use/extend the headless CRM.
---

# Aires Headless CRM — Agent Skill

This is the self-describing playbook for the Aires Headless CRM — the
agent-first rebuild of our real-estate CRM that lives in the
[aires-turbo/](aires-turbo/) monorepo. It is written for **two audiences
in one file**:

- **Runtime agents** (Claude, OpenAI, any MCP client) calling the CRM to do
  real work — send email, SMS, contracts, pull reports, search the KB, remember
  facts, create contacts. Sections 1–7.
- **Builder agents** (Cursor/Claude working inside the repo) extending the CRM
  — adding tools, routes, integrations, scopes. Sections 8–10.

Both audiences share the same primitives. Read section 4 ("Tool Catalog")
and section 5 ("Primitives") before anything else.

When any source under `aires-turbo/apps/core/src/tools/` or
`aires-turbo/docs/HEADLESS_CRM_API_REFERENCE.md` disagrees with this skill,
**the code is the source of truth**. Update this skill; don't "fix" the code.

---

## 1. What this is

Four deployable services, one monorepo, one shared package layer.

| Service           | Port   | Purpose |
| ----------------- | ------ | ------- |
| `apps/core`       | `4000` | Synchronous REST + tRPC + Better-Auth + SSE + tool execution. The only agent-facing ingress. |
| `apps/workers`    | `4100` | BullMQ workers: SendGrid, Aircall, DocuSeal, Blackline, outbox drain, webhook delivery. |
| `apps/mcp-server` | `4200` | MCP-over-SSE bridge. Proxies tool catalog + execution into `apps/core` for external AI clients (Claude Desktop, etc.). |
| `apps/nextjs`     | `3000` | Admin UI. Uses the shared tRPC router. Not an agent surface. |

Shared infra: Postgres (identity, CRM, audit, RAG via pgvector), Redis
(BullMQ + event streams + rate limits + SSE fan-out), S3 (documents).

Canonical references (keep these bookmarked):

- [aires-turbo/README.md](aires-turbo/README.md) — architecture overview
- [aires-turbo/docs/HEADLESS_CRM_API_REFERENCE.md](aires-turbo/docs/HEADLESS_CRM_API_REFERENCE.md) — every endpoint, every tool
- [aires-turbo/docs/HEADLESS_CRM_QUICKSTART.md](aires-turbo/docs/HEADLESS_CRM_QUICKSTART.md) — local + Railway walkthrough
- [aires-turbo/docs/CLAUDE_DESKTOP_MCP.md](aires-turbo/docs/CLAUDE_DESKTOP_MCP.md) — wiring Claude Desktop to `apps/mcp-server`
- [aires-turbo/docs/MCP_AND_AGENT_ARCHITECTURE.md](aires-turbo/docs/MCP_AND_AGENT_ARCHITECTURE.md) — deeper agent identity + tool model
- [aires-turbo/HEADLESS_CRM_CODE_AUDIT.md](aires-turbo/HEADLESS_CRM_CODE_AUDIT.md) — known production-readiness gaps

### Design principles (non-negotiable)

1. **Agents are first-class principals.** Every agent action is scoped,
   rate-limited, and audited as `actor.type = "agent"`. Agents never
   impersonate humans.
2. **Tool execution goes through REST only.** `POST /api/v1/tools/:name` is
   the one execution path. tRPC is for catalog + admin UI, never for agent
   side effects.
3. **Tenant isolation is server-derived, not client-declared.** For agent
   callers, `organizationId` comes from the JWT. Never trust an agent input
   claiming a different org. (See audit finding #1 in
   [aires-turbo/HEADLESS_CRM_CODE_AUDIT.md](aires-turbo/HEADLESS_CRM_CODE_AUDIT.md).)
4. **Writes + events are atomic.** Domain writes publish to the
   transactional outbox ([aires-turbo/packages/events/src/outbox.ts](aires-turbo/packages/events/src/outbox.ts))
   in the same Postgres transaction as the row insert. Workers drain to
   Redis Streams.
5. **No file exceeds ~500 lines.** Splits come before growth.

---

## 2. When to use this skill (triggers)

Follow this skill when you're about to:

- Call any Aires CRM tool from an AI agent
- Mint, rotate, or verify an agent JWT
- List / introspect the tool catalog (MCP `listTools`, REST `/api/v1/tools`, or tRPC `tool.catalog`)
- Compose a multi-step flow against the CRM (e.g. lead intake, campaign reply, contract send)
- Extend the CRM: register a new tool, add a REST route, add an integration, add a scope, add a BullMQ queue
- Debug an agent call: scope denied, rate limited, approval pending, missing org
- Subscribe to CRM events via SSE or webhooks
- Decide what belongs in the headless CRM vs what stays in pxp-server

If your task is about the **PXP monolith / pxp-reactjs-admin / peterson-staging**,
use the PXP skills instead (`pxp-request-analysis-main`,
`sales-transaction-wizard`, `daily-report-v4`, etc.). This skill is
**headless-CRM only**.

---

## 3. Getting started as a runtime agent

### 3.1 Mint an agent JWT

Humans mint agent tokens, agents do not mint themselves.

```bash
curl -X POST "$CORE_URL/api/v1/agents/$AGENT_ID/tokens" \
  -H "cookie: <better-auth-session>"
```

Response:

```json
{
  "token": "<jwt>",
  "expiresAt": "2026-04-20T12:15:00.000Z",
  "agentId": "9b44a40a-2b35-49f7-a1c2-0fd6dcf26f2f",
  "scopes": ["email:send", "kb:search"]
}
```

Rules ([API Reference §3.3](aires-turbo/docs/HEADLESS_CRM_API_REFERENCE.md)):

- TTL: **15 minutes**. Refresh before expiry; don't retry through expiry.
- Every verified token is checked against the `agent_token` table by `jti`
  and the agent's `status`. Revoking a token or disabling an agent takes
  effect on the **next call**, not when the JWT expires naturally.
- Claims: `subject_type=agent`, `agent_id`, `org_id`, `scopes`,
  `project_ids`, `jti`.

### 3.2 Introspect yourself

Before you act, confirm what you are.

```bash
curl "$CORE_URL/api/v1/whoami" \
  -H "authorization: Bearer $AGENT_JWT"
```

Returns actor type, agent id, org id, scopes, allowed project ids, and
`requestId`. If you get `401`, your token is expired or revoked.

### 3.3 List available tools

Three ways, all equivalent in content:

- **MCP client:** `client.listTools()` (most idiomatic for Claude / Cursor / Claude Desktop).
- **REST:** `GET $CORE_URL/api/v1/tools` — public, no auth needed.
- **tRPC:** `tool.catalog` (catalog row in Postgres) or `tool.inMemory` (current process registry). Admin UI uses this.

Each tool entry carries `name`, `displayName`, `description`, `category`,
`requiredScopes`, `requiresApproval`, and `costTier`. Filter by the scopes
returned from `/whoami` to know what you can actually call.

### 3.4 Call a tool

```bash
curl -X POST "$CORE_URL/api/v1/tools/email.send" \
  -H "authorization: Bearer $AGENT_JWT" \
  -H "content-type: application/json" \
  -d '{"to":"buyer@example.com","subject":"Welcome","text":"Hello"}'
```

The pipeline ([API Reference §4.4](aires-turbo/docs/HEADLESS_CRM_API_REFERENCE.md)):

1. Actor resolved from bearer token
2. `organizationId` resolved from JWT (never from input for agents)
3. Scope gate (`hasScope`)
4. Per-tool rate limit: **60 req/min per agent per tool**
5. Project scope resolution (section 5.3)
6. Zod validation of input
7. Handler runs (may enqueue a BullMQ job)
8. Audit log row written on success, denial, or error

Status codes to handle: `400` (validation / missing org), `401` (no actor),
`403` (scope denied / forbidden project), `404` (unknown tool), `429`
(rate limited — back off), `500` (handler threw). Every response echoes
`x-request-id` — always log it.

---

## 4. Canonical tool catalog

These are the tools registered at boot in
[aires-turbo/apps/core/src/tools/index.ts](aires-turbo/apps/core/src/tools/index.ts)
as of today. Drift check: if `registerAllTools()` changes, this table must
change too.

| Tool name          | Scope          | Approval          | Cost    | File |
| ------------------ | -------------- | ----------------- | ------- | ---- |
| `contact.create`   | `contact:write`| no                | low     | [contact.ts](aires-turbo/apps/core/src/tools/contact.ts) |
| `contact.list`     | `contact:read` | no                | free    | [contact.ts](aires-turbo/apps/core/src/tools/contact.ts) |
| `contact.update`   | `contact:write`| no                | low     | [contact.ts](aires-turbo/apps/core/src/tools/contact.ts) |
| `email.send`       | `email:send`   | no                | low     | [email-send.ts](aires-turbo/apps/core/src/tools/email-send.ts) |
| `sms.send`         | `sms:send`     | no                | low     | [sms-send.ts](aires-turbo/apps/core/src/tools/sms-send.ts) |
| `contract.send`    | `contract:send`| **yes** (agents)  | high    | [contract-send.ts](aires-turbo/apps/core/src/tools/contract-send.ts) |
| `report.fetch`     | `report:fetch` | no                | medium  | [report-fetch.ts](aires-turbo/apps/core/src/tools/report-fetch.ts) |
| `kb.search`        | `kb:search`    | no                | low     | [kb-search.ts](aires-turbo/apps/core/src/tools/kb-search.ts) |
| `memory.remember`  | `memory:write` | no (agents only)  | low     | [memory-remember.ts](aires-turbo/apps/core/src/tools/memory-remember.ts) |
| `memory.recall`    | `memory:read`  | no (agents only)  | free    | [memory-remember.ts](aires-turbo/apps/core/src/tools/memory-remember.ts) |

### 4.1 `contact.create` / `contact.list` / `contact.update`

CRM spine. All three are org-scoped; agents never pass `organizationId`
(it's from the JWT). Input accepts snake_case or camelCase — the tool
pre-normalizes via `camelize()`.

```json
// contact.create
{
  "email": "lead@example.com",
  "phone": "+16045551234",
  "firstName": "Ava",
  "lastName": "Doe",
  "source": "website",
  "status": "new",
  "projectId": "uuid-optional",
  "custom": { "utm_source": "google" }
}
```

Side effect: publishes `contact.created` through the outbox. SSE + webhook
subscribers receive it within ~1s.

`contact.list` filters by optional `query` (matches email, first, last —
case-insensitive ILIKE) and optional `projectId`. `limit` max 50.

### 4.2 `email.send`

Queues a SendGrid job. If `contactId` is passed, the worker also logs an
outbound `activity`, writes a `communication` row, and publishes
`email.sent`. `to` accepts a string or an array of strings.

```json
{ "to": ["a@x.com","b@x.com"], "subject": "Hi", "text": "...", "html": "<p>...</p>", "from": "sales@aires.tech", "contactId": "uuid-optional" }
```

Returns `{ jobId, queued: true }`. Follow up by subscribing to `email.sent`
via SSE for delivery confirmation.

### 4.3 `sms.send`

Queues an Aircall SMS. Body max 1600 chars. Returns `{ jobId, queued: true }`.

```json
{ "to": "+16045551234", "body": "Your PC visit is booked.", "contactId": "uuid-optional" }
```

### 4.4 `contract.send` (approval-gated for agents)

High-impact. **Agent callers never send immediately.** Flow:

1. Call `POST /api/v1/tools/contract.send` with `{ templateId, recipients, metadata? }`.
2. The tool opens an `agent_run` row (status `waiting_approval`) and calls
   `requestApproval()`.
3. Response is `{ jobId: "pending", queued: false, approvalId, agentRunId }`.
4. A human approves (admin UI) or rejects via the approvals plane
   ([aires-turbo/packages/agents/src/approvals.ts](aires-turbo/packages/agents/src/approvals.ts)).
5. On approve, the worker enqueues the DocuSeal job. Subscribe to
   `agent_run.completed` (or the future `contract.signed` event) for the
   outcome.

Human callers (user session) skip the approval step and queue immediately.

### 4.5 `report.fetch`

Queues a Blackline report export. `projectId` required (either in input or
via the agent's project scope — see §5.3). `format` in `csv | xlsx | pdf`,
default `csv`. `dateRange.from` / `dateRange.to` are ISO datetimes.

Real-estate-specific `reportType` strings match the Blackline report
registry in the workers package; start with what `report.fetch` tests
exercise.

### 4.6 `kb.search`

Tenant-isolated hybrid search (pgvector + full-text) over the project
knowledge base. `projectId` is resolved from input → agent scope → null
(org-wide). `topK` max 20.

```json
{ "query": "what's the deposit schedule for the Ashleigh 2BR?", "projectId": "uuid-optional", "topK": 8 }
```

Returns `{ hits: [{ chunkId, documentId, title, content, score }] }`.
Use this for merge-field resolution, FAQ answering, contract drafting context.

### 4.7 `memory.remember` / `memory.recall` (agents only)

Per-agent vector memory namespace in pgvector. Humans cannot call these.
Use `namespace` to partition memories (e.g. `"leads:ava-doe"`).

```json
// remember
{ "content": "Ava prefers morning calls. Follow-up 2026-04-24.", "namespace": "leads:ava-doe", "projectId": "uuid-optional", "metadata": { "source": "call-transcript" } }
// recall
{ "query": "any preferences for Ava?", "namespace": "leads:ava-doe", "topK": 5 }
```

### 4.8 Planned tools (not yet shipped)

Do not call these; they do not exist. Flagged so you know what's coming
per [.cursor/plans/aires-headless-crm-parity-build.plan.md](.cursor/plans/aires-headless-crm-parity-build.plan.md):

- Phase 1: `lead-assign`, `list-add-member`, `list-query`, `contact-search` (semantic)
- Phase 2: `unit-search`, `unit-status-get`, `unit-available-count`, `floorplan-lookup`
- Phase 3a: `transaction.create|get|status|list`, `deposit.record`, `demand-note.issue`, `upgrade-option.list`
- Phase 3b: `contract-template.list`, `contract.signing-url`, `merge-fields.resolve`
- Phase 4: `email-send-campaign`, `email-template-render`, `email-thread-get`, `email-suppress`
- Phase 5: `call-log`, `call-initiate`, `note-add`, `task-create`, `meeting-schedule`, `pc-book`, `sales-rep-feed`
- Phase 6: `workflow-list|start|status|cancel|trigger-event`
- Phase 7: `report-generate`, `dashboard-read`, `file-presign-upload`, `blackline-sync-now`

If you need one of these, surface the request — do not improvise a direct
DB call from agent code.

---

## 5. Primitives (the generic surface)

These are the pieces you compose to invent new actions. Anything you can
build in the CRM without adding a new tool comes from here.

### 5.1 HTTP / API surface

Base: `apps/core` on `http://localhost:4000` (prod: the `core` Railway
service URL).

| Method | Path                               | Auth                | Notes |
| ------ | ---------------------------------- | ------------------- | ----- |
| `GET`  | `/healthz` / `/readyz`             | none                | Probes |
| `ALL`  | `/api/auth/*`                      | Better-Auth         | Sessions, OAuth, JWT/JWKS, API keys |
| `ALL`  | `/api/trpc/*`                      | session (protected) | Shared tRPC router; **never** for agent side effects |
| `GET`  | `/api/v1/whoami`                   | session or JWT      | Resolved actor |
| `GET`  | `/api/v1/contacts`                 | authenticated       | Thin wrapper over `contact.list`, max 25 items |
| `POST` | `/api/v1/contacts`                 | authenticated       | Thin wrapper over `contact.create` |
| `GET`  | `/api/v1/tools`                    | public              | Tool catalog |
| `POST` | `/api/v1/tools/:name`              | authenticated       | **Canonical agent execution path** |
| `POST` | `/api/v1/agents/:agentId/tokens`   | user session        | Mint 15-min agent JWT |
| `GET`  | `/events`                          | authenticated       | Live SSE event stream |

Full details in [HEADLESS_CRM_API_REFERENCE.md §4](aires-turbo/docs/HEADLESS_CRM_API_REFERENCE.md).

### 5.2 Actor context

Every request resolves to a typed `ActorContext`:

- `{ type: "user", userId, sessionId, orgId? }` — Better-Auth session cookie
- `{ type: "agent", agentId, tokenId, scopes, projectIds, orgId? }` — agent JWT

The middleware also sets `ctx.requestId` (echoed as `x-request-id`) and
`ctx.organizationId` (never null for tool calls). Use
[packages/auth](aires-turbo/packages/auth/) helpers (`resolveOrgId`,
`hasScope`) if you're writing server code.

### 5.3 Scope grammar

Tool access is gated by scopes. Rules from
[API Reference §3.4](aires-turbo/docs/HEADLESS_CRM_API_REFERENCE.md):

- Agents must satisfy **every** `requiredScope` a tool declares.
- `tools:*` is the global wildcard.
- `<category>:*` is a category wildcard (e.g. `email:*` grants `email:send` and all future `email:...`).
- Aliases: `contract` ↔ `contracts`, `report:fetch` ↔ `reports:read`, `kb:search` ↔ `kb:read`.
- Humans are trusted for scope checks (admin UI does not gate by scope).

### 5.4 Project scope

When a tool takes `projectId`, `apps/core` applies:

- Non-agent actors: any `projectId` is fine.
- Agents with no `projectIds`: unrestricted.
- Agents with explicit `projectId` claim: input must match one of the
  allowed projects, else 403.
- Agents with exactly one allowed project: omit `projectId`; the server
  infers it.
- Agents with multiple allowed projects and no input: no project
  resolved; tools requiring one will fail with 400.

### 5.5 Events + SSE

Canonical event catalog in [packages/events/src/schemas.ts](aires-turbo/packages/events/src/schemas.ts):

| EventType              | Payload shape |
| ---------------------- | ------------- |
| `contact.created`      | `{ contactId, email?, phone? }` |
| `contact.updated`      | `{ contactId, email?, phone? }` |
| `activity.logged`      | `{ activityId, contactId?, kind }` |
| `email.sent`           | `{ messageId, to, subject? }` |
| `task.created`         | `{ taskId }` |
| `agent_run.started`    | `{ agentRunId, agentId, tool }` |
| `agent_run.completed`  | `{ agentRunId, agentId, tool, status, costCents }` |
| `approval.requested`   | `{ approvalId, agentRunId }` |

Subscribe via `GET /events` (SSE) — filtered by your org and (for agents)
your allowed projects. For external systems, use webhook subscriptions
via the `subscription` tRPC router (`create` / `list` / `setActive`),
which uses HMAC signatures and retries with backoff
([packages/events/src/webhook-delivery.ts](aires-turbo/packages/events/src/webhook-delivery.ts)).

Publisher pattern (server-side only):

```ts
import { EventType, publish } from "@acme/events";
await publish(tx, {
  organizationId,
  eventType: EventType.ContactCreated,
  aggregateType: "contact",
  aggregateId: row.id,
  payload: { contactId: row.id, email: row.email ?? undefined },
  actor: { type: ctx.actor.type, id: actorId },
});
```

`publish()` enforces the schema and writes into the same Postgres
transaction as the domain row. Do not use `pusher.trigger()` or any
side-channel.

### 5.6 Approvals plane

[aires-turbo/packages/agents/src/approvals.ts](aires-turbo/packages/agents/src/approvals.ts).
A tool with `requiresApproval: true` does this for agent callers:

1. Open an `agent_run` (`status: waiting_approval`).
2. Call `requestApproval({ agentRunId, organizationId, reason, actor })`.
3. Emit `approval.requested` event.
4. Return `{ jobId: "pending", queued: false, approvalId, agentRunId }`.
5. Human approves → worker resumes → `agent_run.completed` emitted.

Agents **poll `agent_run.completed` via SSE** rather than blocking.

### 5.7 Audit log

Every tool call writes to `audit_log` with `actor_type`, `tool`, `action`,
`args`, `result`, `requestId`, and optional `approvalId` / `runId`
([aires-turbo/packages/agents/src/audit.ts](aires-turbo/packages/agents/src/audit.ts)).
Query via tRPC `audit.list` / `audit.stats` (session required). For
agent-side introspection, listen to events — agents do not browse audit
logs.

### 5.8 RAG + memory

[aires-turbo/packages/rag/](aires-turbo/packages/rag/) wraps pgvector.
`kb.search` is the read path (hybrid vector + BM25). `memory.remember` /
`memory.recall` use the same backing store, partitioned by `agentId`.
`organizationId` always comes from the actor context — never from tool
input — so cross-tenant bleed is a code bug, not a config mistake.

### 5.9 Rate limits

Per-tool, per-agent, Redis-backed: **60 req/min**. Response on exceed is
`429` with a `Retry-After` header. Implement exponential backoff on the
agent side; do not hammer.

---

## 6. Recipes (composable sub-skills)

Pre-baked flows are in [subskills/](aires-turbo/.cursor/skills/headless-crm/subskills/).
Each file is a numbered sequence of tool calls you can copy into any agent
loop. Current set:

- [subskills/lead-intake.md](aires-turbo/.cursor/skills/headless-crm/subskills/lead-intake.md) — website lead → contact.create → welcome email → follow-up task.
- [subskills/campaign-reply.md](aires-turbo/.cursor/skills/headless-crm/subskills/campaign-reply.md) — inbound reply → contact.list → memory.recall → personalized email.send.
- [subskills/contract-prefill-send.md](aires-turbo/.cursor/skills/headless-crm/subskills/contract-prefill-send.md) — kb.search for merge fields → contract.send (approval-gated) → SSE poll.
- [subskills/daily-report-dispatch.md](aires-turbo/.cursor/skills/headless-crm/subskills/daily-report-dispatch.md) — report.fetch V4 daily → email.send to stakeholders.

When you invent a new flow, **write it down** in `subskills/` and
reference it here so the next agent doesn't re-solve the problem.

---

## 7. Domain context (real-estate CRM glossary)

The headless CRM models the same real-estate domain as PXP. Terminology
you'll encounter in tool inputs, event payloads, and KB docs:

| Term                    | Meaning |
| ----------------------- | ------- |
| **Project**             | One condo / townhouse / lot development. All CRM data is scoped to a project. |
| **Building**            | A physical structure within a project. A project has 1+ buildings. |
| **Unit**                | A single sellable home (condo suite, townhouse, lot). Belongs to a building. |
| **Floorplan / Home Design** | Reusable unit templates with square-footage, bedrooms, finishes. Units reference them. |
| **Buyer**               | Human purchasing a unit. Multiple buyers per transaction. |
| **Broker / Realtor**    | Represents a buyer; earns commission. |
| **Corporation**         | A corporate buyer (with `corporateMember`s as signatories). |
| **SalesTransaction**    | The deal. Has state: conditional → firm → closed. Contains unit, buyers, brokers, deposits, upgrades, offers, commission. |
| **Deposit**             | Scheduled payment(s) per transaction. `depositOption` is a template; actual payments are `payment` rows. |
| **Upgrade / Option**    | Paid add-ons (extra parking, premium finishes). Drive the pricing engine. |
| **Merge fields**        | Named tokens (`{buyer.firstName}`, `{unit.suiteNumber}`) resolved from transaction + form data into contract PDFs and emails. Single source of truth lives in Phase 3b merge-field catalog. |
| **Demand Note**         | Fee-bearing document issued against a transaction (upgrade change, delay fee, etc.). |
| **Lead**                | A contact with intent. Lifecycle: new → qualified → assigned → PC visit booked → under contract → firm. |
| **PC visit**            | Presentation Centre appointment. Anchors the lead-to-buyer conversion. |
| **Firm vs Conditional vs Closed** | Transaction states. Conditional = subjects outstanding; firm = all subjects met; closed = occupancy + title transfer complete. |

You don't need to understand the pxp-server implementation to use the
headless CRM — but if you're adapting a PXP flow, see
[.cursor/skills/sales-transaction-wizard/SKILL.md](.cursor/skills/sales-transaction-wizard/SKILL.md)
and [.cursor/skills/sales-transaction-merge-fields/SKILL.md](.cursor/skills/sales-transaction-merge-fields/SKILL.md)
for domain intuition. Those describe pxp-server behavior; headless
equivalents come online per phase in
[.cursor/plans/aires-headless-crm-parity-build.plan.md](.cursor/plans/aires-headless-crm-parity-build.plan.md).

---

## 8. How to build a sub-skill (runtime agents)

A sub-skill is a short Markdown recipe an agent can follow or adapt. To
author one:

1. Create `aires-turbo/.cursor/skills/headless-crm/subskills/<name>.md`.
2. Use this template:

```markdown
# <Goal in one line>

**Prereqs:** scopes needed, any prior tool calls.

## Steps

1. `tool.name(...)` — why
2. `tool.name(...)` — why
3. `SSE wait event.type` — why

## Failure modes

- `429` on step 2 → exponential backoff.
- `approval.requested` emitted on step 3 → return `approvalId` to the caller; poll `agent_run.completed`.

## Follow-ups

- Update `memory.remember` with the outcome.
- Emit an activity note via `activity.log` (tRPC) if a human needs to see it.
```

3. Reference it from section 6 of this file.

Composition rules:

- Every write action must be scoped and audited — don't bypass `POST /api/v1/tools/:name`.
- Never claim `organizationId` in input when you're an agent.
- For long-running flows, return early with `agentRunId` + `approvalId` and let the caller poll.
- Use `memory.remember` for facts that should survive across runs; use
  `kb.search` for tenant-wide reference data.

---

## 9. Builder guide (Cursor devs extending the CRM)

### 9.1 File map

```
aires-turbo/
  apps/
    core/                  Hono REST + tRPC + SSE + tool execution (port 4000)
      src/tools/           Every first-party tool lives here, one per file
      src/rest/            Thin REST wrappers (contact, tool, chat-threads)
      src/middleware/      Actor resolution, requireScope, x-request-id
      src/webhooks/        Inbound webhooks (DocuSeal, Aircall, SendGrid)
      src/sse.ts           Authenticated SSE stream at /events
    workers/               BullMQ consumers (port 4100)
      src/queues/          One queue module per integration
    mcp-server/            MCP SSE proxy (port 4200)
    nextjs/                Admin UI (port 3000, tRPC only)
  packages/
    auth/                  Better-Auth init, org resolver, agent JWT verification, scopes
    db/                    Drizzle schema + client (identity, crm, events, agents, rag)
    api/                   tRPC routers (contact, activity, task, agent, audit, subscription, tool)
    agents/                Tool registry, defineTool, approvals, rate-limit, audit helpers
    events/                Outbox, Redis Streams, webhook delivery, event schemas
    integrations/          SendGrid / Aircall / DocuSeal / Blackline adapters
    rag/                   pgvector, hybrid search, OpenAI embed provider, agent memory
    observability/         Pino + OTel bootstrap
    sync-pxp/              One-shot PXP Mongo → Postgres bootstrap CLI
    validators/            Shared Zod schemas
```

### 9.2 Add a new tool

1. Create `apps/core/src/tools/<name>.ts`.
2. Use `defineTool({ name, requiredScopes, requiresApproval, costTier, inputSchema, outputSchema, handler })` from `@acme/agents`.
3. The handler receives `{ input, ctx }` where `ctx.organizationId`,
   `ctx.actor`, `ctx.requestId` are already resolved. Call
   `writeAudit(ctx, {...})` on exit (success or failure).
4. For high-impact tools, set `requiresApproval: true` and in the handler:
   for agent actors, insert an `agent_run` row, call `requestApproval()`,
   and return `{ queued: false, approvalId, agentRunId }` — see
   [contract-send.ts](aires-turbo/apps/core/src/tools/contract-send.ts)
   as the reference implementation.
5. Export `register<Name>Tool()` and add it to
   [tools/index.ts](aires-turbo/apps/core/src/tools/index.ts).
6. Add the new scope string to `packages/auth/src/scopes.ts` (Phase 0
   registry). Seed any default agent that needs it.
7. Write unit tests: happy path, scope-denied, rate-limited, validation
   failure. Pattern in `apps/core/tests/scope.test.ts`.
8. Update section 4 of this skill with the new row. Update
   [HEADLESS_CRM_API_REFERENCE.md §6](aires-turbo/docs/HEADLESS_CRM_API_REFERENCE.md).

### 9.3 Add a new REST route

1. Create `apps/core/src/rest/<resource>.ts`.
2. Wrap `requireActor` + `requireScope(scopeString)` middleware.
3. Validate with Zod at the boundary.
4. Delegate to the shared tRPC caller (`apps/core/src/trpc-caller.ts`)
   or directly to `@acme/db` for simple reads.
5. Never accept `organizationId` from an agent caller's body — read it
   from `ctx.organizationId`.
6. Update the endpoint table in section 5.1 and in the API reference.

### 9.4 Add a new integration

1. Create `packages/integrations/src/<vendor>/` with:
   - `client.ts` — typed SDK wrapper
   - `types.ts` — shared Zod schemas (like `ContractSignRequestSchema` in DocuSeal)
   - `webhook.ts` — HMAC verifier, idempotency table helper
2. Add the queue consumer in `apps/workers/src/queues/<vendor>.ts`.
3. Add the inbound webhook route in `apps/core/src/webhooks/<vendor>.ts`,
   protected only by HMAC (no actor required).
4. Register envs in `apps/core/src/env.ts` and `apps/workers/src/env.ts`.
5. Document in [ENV_REFERENCE.md](aires-turbo/docs/ENV_REFERENCE.md).

### 9.5 Add a new event

1. Add the enum member + Zod payload schema in
   [packages/events/src/schemas.ts](aires-turbo/packages/events/src/schemas.ts).
2. Update `payloadSchemaForEvent`.
3. Call `publish(tx, {...})` inside the same Postgres transaction as the
   domain write. Never emit "after the fact" outside the tx.
4. Subscribers (SSE, webhooks) pick it up automatically.

### 9.6 Parity roadmap

See [.cursor/plans/aires-headless-crm-parity-build.plan.md](.cursor/plans/aires-headless-crm-parity-build.plan.md)
for the 10-phase plan (0, 1, 2, 3a, 3b, 4, 5, 6, 7, 8). New features
belong in a phase; if your change doesn't fit a phase, surface it before
coding.

Related but distinct: [.cursor/plans/headless-ai-crm-railway.plan.md](.cursor/plans/headless-ai-crm-railway.plan.md)
describes a separate strangler-fig plan that extracts pxp-server into
Railway microservices. Do not conflate the two — the parity plan is the
active one for aires-turbo.

---

## 10. Constraints & guardrails

**Tenant isolation.** For agent actors, `organizationId` is the JWT claim.
Never read it from the body, query string, or header. Audit finding #1 in
[HEADLESS_CRM_CODE_AUDIT.md](aires-turbo/HEADLESS_CRM_CODE_AUDIT.md)
documents places this was violated in tRPC — those are bugs, not pattern.

**Approval gate.** Tools with `requiresApproval: true` must return
immediately with `approvalId` for agent callers. Do not block. Do not
silently fall back to executing.

**JWT lifecycle.** 15-minute TTL, revocation is database-checked on every
call. Agents refresh; they do not retry through expiry. Disabling an
agent takes effect on the next call.

**Scope grammar.** Single source of truth is `packages/auth/src/scopes.ts`.
Adding a scope without updating the registry is a runtime-only grant and
will fail audit.

**Rate limits.** 60 req/min per agent per tool. Agents back off on `429`.

**File size.** No file > 500 lines. Split at the boundary before growing.

**Observability.** Every request echoes `x-request-id`. Every tool call
writes `audit_log`. Every publish goes through `@acme/events.publish`.
Every domain mutation is in a Postgres transaction with its outbox event.
No `console.log` (CI-enforced).

**No cross-vertical imports.** `apps/workers` reads `@acme/db` and
`@acme/integrations`. `apps/core` reads `@acme/agents`, `@acme/events`,
`@acme/auth`. Never import another app's source directly.

---

## 11. Environment & endpoints

Local:

- `apps/core` → `http://localhost:4000`
- `apps/workers` → `http://localhost:4100` (health only)
- `apps/mcp-server` → `http://localhost:4200/sse` (MCP SSE)
- `apps/nextjs` → `http://localhost:3000`

Envs: canonical in [aires-turbo/docs/ENV_REFERENCE.md](aires-turbo/docs/ENV_REFERENCE.md)
and [aires-turbo/.env.example](aires-turbo/.env.example). Required at
minimum: `POSTGRES_URL`, `REDIS_URL`, `BETTER_AUTH_SECRET`, plus
integration keys (`SENDGRID_API_KEY`, `AIRCALL_API_KEY`, `DOCUSEAL_API_KEY`,
`BLACKLINE_API_TOKEN`, `OPENAI_API_KEY` for RAG).

Railway: the repo ships four `railpack.*.json` files
([railpack.core.json](aires-turbo/railpack.core.json),
[railpack.workers.json](aires-turbo/railpack.workers.json),
[railpack.mcp-server.json](aires-turbo/railpack.mcp-server.json),
[railpack.agent-harness.json](aires-turbo/railpack.agent-harness.json))
plus [railpack.chat-web.json](aires-turbo/railpack.chat-web.json).
Provision the Postgres + Redis plugins (enable `pgvector` via
`CREATE EXTENSION`) and deploy each `apps/*` as a separate service.

MCP from Claude Desktop: follow
[CLAUDE_DESKTOP_MCP.md](aires-turbo/docs/CLAUDE_DESKTOP_MCP.md). The SSE
URL is `https://<mcp-host>/sse?agent=<agentId>&token=<jwt>`; all tool
invocations proxy into `apps/core`, so the security model is identical.

---

## 12. References

### Inside the repo

- Code: [apps/core/src/tools/](aires-turbo/apps/core/src/tools/), [packages/agents/](aires-turbo/packages/agents/), [packages/events/](aires-turbo/packages/events/), [packages/auth/](aires-turbo/packages/auth/), [packages/rag/](aires-turbo/packages/rag/), [packages/integrations/](aires-turbo/packages/integrations/)
- Docs: [HEADLESS_CRM_QUICKSTART.md](aires-turbo/docs/HEADLESS_CRM_QUICKSTART.md), [HEADLESS_CRM_API_REFERENCE.md](aires-turbo/docs/HEADLESS_CRM_API_REFERENCE.md), [MCP_AND_AGENT_ARCHITECTURE.md](aires-turbo/docs/MCP_AND_AGENT_ARCHITECTURE.md), [CLAUDE_DESKTOP_MCP.md](aires-turbo/docs/CLAUDE_DESKTOP_MCP.md), [ENV_REFERENCE.md](aires-turbo/docs/ENV_REFERENCE.md), [DEV_QUICKSTART.md](aires-turbo/docs/DEV_QUICKSTART.md), [PXP_SERVER_CAPABILITIES.md](aires-turbo/docs/PXP_SERVER_CAPABILITIES.md)
- Audit: [HEADLESS_CRM_CODE_AUDIT.md](aires-turbo/HEADLESS_CRM_CODE_AUDIT.md)

### Plans

- Active parity rebuild: [.cursor/plans/aires-headless-crm-parity-build.plan.md](.cursor/plans/aires-headless-crm-parity-build.plan.md)
- Alternative strangler-fig (pxp-server extraction, not active): [.cursor/plans/headless-ai-crm-railway.plan.md](.cursor/plans/headless-ai-crm-railway.plan.md)

### Related skills (PXP domain, not headless)

Use only for porting intuition. These describe pxp-server, not aires-turbo.

- [.cursor/skills/sales-transaction-wizard/SKILL.md](.cursor/skills/sales-transaction-wizard/SKILL.md)
- [.cursor/skills/sales-transaction-merge-fields/SKILL.md](.cursor/skills/sales-transaction-merge-fields/SKILL.md)
- [.cursor/skills/daily-report-v4/SKILL.md](.cursor/skills/daily-report-v4/SKILL.md)
- [.cursor/skills/pxp-feature-architecture/SKILL.md](.cursor/skills/pxp-feature-architecture/SKILL.md)
- [.cursor/skills/pxp-permissions-checklist/SKILL.md](.cursor/skills/pxp-permissions-checklist/SKILL.md)
- [.cursor/skills/pxp-failure-patterns/SKILL.md](.cursor/skills/pxp-failure-patterns/SKILL.md)
