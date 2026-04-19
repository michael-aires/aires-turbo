# Aires Headless CRM API Reference

This document describes the implemented backend in `aires-turbo`, based on the
current code in:

- `apps/core`
- `apps/workers`
- `apps/mcp-server`
- `packages/api`
- `packages/auth`
- `packages/db`
- `packages/events`
- `packages/rag`

When older notes in the repo disagree with the code, the code is the source of
truth. One important example: the live Server-Sent Events endpoint is
`GET /events`, not `/events/stream`.

## 1. System Summary

The headless CRM is split into three backend services and one admin consumer:

| Service | Port | Purpose |
| --- | --- | --- |
| `apps/core` | `4000` | Main HTTP API. Hosts Better-Auth, tRPC, REST v1, tool execution, and SSE. |
| `apps/workers` | `4100` | BullMQ workers for SendGrid, Aircall, DocuSeal, Blackline, plus outbox and webhook delivery loops. |
| `apps/mcp-server` | `4200` | MCP-over-SSE bridge for external AI clients. Proxies tool calls into `apps/core`. |
| `apps/nextjs` | `3000` | Admin UI. Uses the shared tRPC router and shared packages. |

Shared infrastructure:

- Postgres stores identity, CRM data, audit rows, subscriptions, agent runs,
  and RAG data.
- Redis backs BullMQ, the event stream, SSE broadcast fan-out, and tool rate
  limiting.
- Better-Auth provides user sessions, organization membership, API key plugin
  support, and JWT signing/JWKS exposure for agent tokens.

## 2. Request and Event Flow

### Human UI flow

1. A user authenticates through Better-Auth.
2. The user calls protected tRPC procedures with a session cookie.
3. tRPC writes CRM data directly through Drizzle.
4. Domain writes publish outbox events inside the same transaction.
5. Workers drain the outbox, broadcast SSE, and enqueue webhook deliveries.

### Agent flow

1. A human user creates an agent and mints a short-lived JWT for it.
2. The agent calls `POST /api/v1/tools/:name` with `Authorization: Bearer`.
3. `apps/core` resolves actor, organization, scopes, and project scope.
4. The tool either returns immediately, queues background work, or opens an
   approval flow.
5. Workers process jobs and emit durable events.

### MCP flow

1. An external AI client connects to `apps/mcp-server` over SSE with an agent JWT.
2. The MCP server fetches the tool catalog from `apps/core`.
3. Each MCP tool invocation proxies back into `apps/core`.
4. Final validation still happens in `apps/core`.

## 3. Authentication, Actors, and Tenant Isolation

## 3.1 Actor Types

`apps/core` resolves requests into a typed actor context:

- `user`: Better-Auth session cookie, `userId`, `sessionId`, optional `orgId`
- `agent`: signed JWT, `agentId`, `tokenId`, `scopes`, `projectIds`, optional
  `orgId`

The request middleware sets and echoes `x-request-id` on every request.

## 3.2 User Sessions

User-backed access is handled by Better-Auth and used by:

- `/api/auth/*`
- protected tRPC procedures
- `POST /api/v1/agents/:agentId/tokens`
- REST contact endpoints when called from a browser or admin client

For users, organization selection works like this:

- if `x-organization-id` is present, the user must belong to that org
- if no org header is present and the user belongs to exactly one org, that org
  is used automatically
- if the user belongs to multiple orgs and no header is sent, organization
  resolution stays ambiguous until the caller selects one

## 3.3 Agent JWTs

Agent JWTs are minted through:

- `POST /api/v1/agents/:agentId/tokens`

Current behavior:

- only a human user can mint an agent token
- the user must own the agent
- the agent must be `active`
- token TTL is 15 minutes
- claims include `subject_type=agent`, `agent_id`, `org_id`, `scopes`,
  `project_ids`, and `jti`
- verification uses Better-Auth JWKS plus a database revocation check against
  `agent_token`
- an agent whose status is not `active` is rejected even if the JWT is still
  cryptographically valid

## 3.4 Scope Model

Tool access is controlled by scopes. Important rules:

- human users are trusted for tool scope checks
- agents must satisfy every required scope
- `tools:*` is a global wildcard
- `<category>:*` is a category wildcard such as `email:*`
- alias handling exists for some categories:
  - `contract` and `contracts`
  - `report:fetch` and `reports:read`
  - `kb:search` and `kb:read`

## 3.5 Project Scope Resolution

When a tool input includes `projectId`, `apps/core` applies project scoping:

- non-agent actors can pass any `projectId`
- agents with no `projectIds` are unrestricted by project
- agents with an explicit `projectId` must request one of their allowed projects
- agents with exactly one allowed project can omit `projectId`, and the server
  will infer it
- agents with multiple allowed projects and no explicit `projectId` leave the
  tool without a resolved project; tools that require a project can still fail

## 4. Core HTTP API

Base service: `apps/core` on `http://localhost:4000`

## 4.1 Endpoint Summary

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| `GET` | `/healthz` | none | Liveness probe |
| `GET` | `/readyz` | none | Readiness probe |
| `ALL` | `/api/auth/*` | Better-Auth managed | Session, OAuth, JWT/JWKS, API key plugin surface |
| `ALL` | `/api/trpc/*` | session for protected procedures | Shared tRPC router |
| `GET` | `/api/v1/whoami` | user session or agent JWT | Returns resolved actor context |
| `GET` | `/api/v1/contacts` | authenticated | Thin REST wrapper over `contact.list` |
| `POST` | `/api/v1/contacts` | authenticated | Thin REST wrapper over `contact.create` |
| `GET` | `/api/v1/tools` | none | Public tool catalog |
| `POST` | `/api/v1/tools/:name` | authenticated | Canonical tool execution path |
| `POST` | `/api/v1/agents/:agentId/tokens` | user session | Mint short-lived agent JWT |
| `GET` | `/events` | authenticated | Live SSE event stream |

## 4.2 `GET /api/v1/whoami`

Returns the resolved actor and request id.

Example response:

```json
{
  "actor": {
    "type": "agent",
    "agentId": "9b44a40a-2b35-49f7-a1c2-0fd6dcf26f2f",
    "tokenId": "1f9750c5-4f75-47d1-bdc8-7b0832c46dd9",
    "scopes": ["email:send", "kb:search"],
    "projectIds": [],
    "orgId": "de6d40d2-6d4b-421f-9a27-2f269ea92c0f"
  },
  "requestId": "1ecf5e59-6bc2-4536-92bf-6b996b8f0b15"
}
```

Error cases:

- `401` if no user session or bearer token is resolved

## 4.3 Contacts REST

These routes are intentionally thin wrappers around the shared tRPC router.

### `GET /api/v1/contacts`

Query parameters:

| Name | Required | Type | Notes |
| --- | --- | --- | --- |
| `organizationId` | yes | UUID | Required by the REST adapter |

Behavior:

- delegates to `contact.list`
- returns at most 25 items because the REST adapter does not expose `limit`
- does not expose `projectId` or `cursor`

Example:

```bash
curl "http://localhost:4000/api/v1/contacts?organizationId=<org-id>" \
  -H "cookie: <better-auth-session>"
```

### `POST /api/v1/contacts`

Input fields are validated by `CreateContactSchema`.

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `organizationId` | yes | UUID | Tenant scope |
| `projectId` | no | UUID | Project association |
| `email` | no | email | Max 320 chars |
| `phone` | no | string | Max 32 chars |
| `firstName` | no | string | Max 128 chars |
| `lastName` | no | string | Max 128 chars |
| `source` | no | string | Max 64 chars |
| `status` | no | string | Defaults to `new` in DB |
| `custom` | no | object | Arbitrary JSON object |

On success:

- returns the inserted contact row
- publishes `contact.created` into the transactional outbox

Validation errors:

- `400` with `{ error: "validation", issues: [...] }`

## 4.4 Tool Catalog and Execution

### `GET /api/v1/tools`

Public endpoint that lists the registered first-party tool catalog.

Each item includes:

- `name`
- `displayName`
- `description`
- `category`
- `requiredScopes`
- `requiresApproval`
- `costTier`

### `POST /api/v1/tools/:name`

This is the canonical agent-facing execution path. Tools are not executed
through tRPC.

Execution pipeline:

1. Resolve actor from session or bearer token.
2. Resolve `organizationId`.
3. Verify scope requirements.
4. For agent callers, apply per-tool Redis rate limiting: 60 requests per
   minute per agent per tool.
5. Resolve project scope from input.
6. Validate tool input with Zod.
7. Run the tool handler.
8. Write audit rows for success, denial, or error.

Common status codes:

| Status | Meaning |
| --- | --- |
| `400` | Missing organization, invalid input, or project-dependent tool missing project context |
| `401` | No authenticated actor |
| `403` | Insufficient scope or forbidden project access |
| `404` | Unknown tool name |
| `429` | Agent exceeded per-tool rate limit |
| `500` | Tool handler threw |

Example:

```bash
curl -X POST "http://localhost:4000/api/v1/tools/email.send" \
  -H "authorization: Bearer <agent-jwt>" \
  -H "content-type: application/json" \
  -d '{
    "to": "buyer@example.com",
    "subject": "Welcome",
    "text": "Hello from Aires"
  }'
```

## 4.5 `POST /api/v1/agents/:agentId/tokens`

User-only endpoint for minting a short-lived agent JWT.

Response fields:

| Field | Type | Notes |
| --- | --- | --- |
| `token` | string | Signed JWT |
| `expiresAt` | ISO datetime | 15 minute TTL |
| `agentId` | UUID | Agent identifier |
| `scopes` | string[] | Scopes copied into the token |

Errors:

- `403` if the caller is not a user, does not own the agent, or lacks access
- `404` if the agent does not exist
- `409` if the agent is not `active`

## 4.6 `GET /events`

Authenticated SSE stream backed by Redis pub/sub broadcast.

Behavior:

- user actors only receive events for organizations they can access
- agent actors only receive events for their token organization
- if the agent has project restrictions, only matching project events are sent
- the server writes SSE frames with:
  - `id = envelope.id`
  - `event = envelope.type`
  - `data = JSON.stringify(envelope)`

Example:

```bash
curl -N "http://localhost:4000/events" \
  -H "authorization: Bearer <agent-jwt>"
```

## 5. tRPC API

Mounted in `apps/core` at `/api/trpc/*`. The same shared router is also reused
by the admin app.

Important boundary:

- protected procedures require a Better-Auth session
- agent JWTs are not the normal access path for tRPC
- tool execution still goes through REST only

## 5.1 Router Inventory

| Router | Procedures | Notes |
| --- | --- | --- |
| `auth` | `getSession`, `getSecretMessage` | Session inspection and template example |
| `post` | `all`, `byId`, `create`, `delete` | Template/demo router retained from the starter |
| `contact` | `list`, `byId`, `create`, `count` | CRM contact queries and creation |
| `activity` | `list`, `log` | Activity feed and insert |
| `task` | `list`, `create`, `setStatus` | Task tracking |
| `agent` | `list`, `byId`, `create`, `tokens`, `revokeToken` | Agent management |
| `subscription` | `list`, `create`, `setActive` | Webhook subscription management |
| `tool` | `catalog`, `inMemory` | Catalog only, no execution |
| `audit` | `list`, `stats` | Audit browsing and grouped counts |

## 5.2 Procedure Notes

### `contact`

- `contact.list`
  - input: `organizationId`, optional `projectId`, optional `limit`, optional
    `cursor`
  - output: `{ items, nextCursor }`
  - note: the `cursor` input exists, but the current SQL query does not apply
    it yet
- `contact.byId`
  - input: `{ id }`
- `contact.create`
  - input: `CreateContactSchema`
  - side effect: publishes `contact.created`
- `contact.count`
  - input: `{ organizationId }`

### `activity`

- `activity.list`
  - input: `organizationId`, optional `contactId`, optional `limit`
- `activity.log`
  - input: `CreateActivitySchema`
  - side effect: publishes `activity.logged`

### `task`

- `task.list`
  - input: `organizationId`, optional `status`, optional `limit`
- `task.create`
  - input: `CreateTaskSchema`
- `task.setStatus`
  - input: `{ id, status }`
  - allowed statuses: `open`, `in_progress`, `blocked`, `done`, `cancelled`

### `agent`

- `agent.list`
  - input: `{ organizationId }`
- `agent.byId`
  - input: `{ id }`
- `agent.create`
  - input includes name, description, scopes, projectIds, rateLimitTier,
    spendCapCents, and optional model
- `agent.tokens`
  - input: `{ agentId }`
- `agent.revokeToken`
  - input: `{ tokenId }`

### `subscription`

- `subscription.list`
  - input: `{ organizationId }`
- `subscription.create`
  - input:
    - `organizationId`
    - `url`
    - `secret`
    - optional `description`
    - `eventTypes`
    - optional `projectIds`
  - note: webhook URL is validated before insert
- `subscription.setActive`
  - input: `{ id, active }`

### `tool`

- `tool.catalog`
  - returns enabled tools from the database catalog
- `tool.inMemory`
  - returns the current process registry

### `audit`

- `audit.list`
  - input: `organizationId`, optional `actorType`, optional `tool`, optional
    `result`, optional `limit`
- `audit.stats`
  - input: `{ organizationId }`
  - output: grouped counts by `result` and `tool`

## 6. First-Party Tool Reference

Registered on `apps/core` boot and synced into the `tool` table.

| Tool | Scope | Approval | Cost | Backing behavior |
| --- | --- | --- | --- | --- |
| `email.send` | `email:send` | no | `low` | Enqueues BullMQ email job, workers send through SendGrid |
| `sms.send` | `sms:send` | no | `low` | Enqueues BullMQ SMS job, workers send through Aircall |
| `contract.send` | `contract:send` | yes for agents | `high` | Agent callers open approval flow, human callers queue DocuSeal job directly |
| `report.fetch` | `report:fetch` | no | `medium` | Enqueues Blackline report export |
| `kb.search` | `kb:search` | no | `low` | Runs tenant-scoped hybrid pgvector plus full-text search |
| `memory.remember` | `memory:write` | no | `low` | Stores agent memory embedding |
| `memory.recall` | `memory:read` | no | `free` | Recalls top-K agent memories |

## 6.1 `email.send`

Input:

```json
{
  "to": "buyer@example.com",
  "subject": "Welcome",
  "text": "Hello",
  "html": "<p>Hello</p>",
  "from": "sales@aires.tech",
  "contactId": "uuid-optional"
}
```

Output:

```json
{
  "jobId": "123",
  "queued": true
}
```

Notes:

- `to` can be a single email or array of emails
- if `contactId` and `organizationId` are present, the email worker records an
  outbound `activity`, writes a `communication` row, and publishes `email.sent`

## 6.2 `sms.send`

Input:

```json
{
  "to": "+16045551234",
  "body": "Your appointment is confirmed",
  "contactId": "uuid-optional"
}
```

Output:

```json
{
  "jobId": "456",
  "queued": true
}
```

## 6.3 `contract.send`

Input:

```json
{
  "templateId": "docuseal-template-id",
  "recipients": [
    {
      "email": "buyer@example.com",
      "name": "Buyer Name",
      "role": "buyer"
    }
  ],
  "metadata": {
    "transactionId": "abc123"
  },
  "contactId": "uuid-optional"
}
```

Agent caller output:

```json
{
  "jobId": "pending",
  "queued": false,
  "approvalId": "approval-uuid",
  "agentRunId": "run-uuid"
}
```

Human caller output:

```json
{
  "jobId": "789",
  "queued": true
}
```

Notes:

- agent callers do not enqueue DocuSeal immediately
- agent callers create `agent_run`, request an approval, and return pending
- human callers queue the BullMQ `contracts` job directly

## 6.4 `report.fetch`

Input:

```json
{
  "projectId": "project-uuid",
  "reportType": "traffic-report",
  "format": "csv",
  "dateRange": {
    "from": "2026-04-01T00:00:00.000Z",
    "to": "2026-04-19T23:59:59.000Z"
  }
}
```

Notes:

- `projectId` is required either in the payload or via resolved agent project
  scope
- if no project can be resolved, the tool throws

## 6.5 `kb.search`

Input:

```json
{
  "query": "latest call notes for tower A",
  "projectId": "project-uuid-optional",
  "topK": 8
}
```

Output:

```json
{
  "hits": [
    {
      "chunkId": "chunk-uuid",
      "documentId": "document-uuid",
      "title": "Tower A notes",
      "content": "Matched excerpt...",
      "score": 0.91
    }
  ]
}
```

Notes:

- organization isolation comes from actor context, not from user-supplied input
- combines pgvector cosine similarity with PostgreSQL full-text ranking

## 6.6 `memory.remember` and `memory.recall`

`memory.remember` input:

```json
{
  "content": "Buyer prefers SMS follow-up after 5pm",
  "namespace": "sales",
  "projectId": "project-uuid-optional",
  "metadata": {
    "source": "agent-note"
  }
}
```

`memory.recall` input:

```json
{
  "query": "buyer communication preference",
  "namespace": "sales",
  "topK": 5
}
```

Notes:

- both tools are agent-only by handler rule
- memory rows are stored in `agent_memory`
- recall is filtered by `agentId` and `namespace`

## 7. Events, SSE, and Webhooks

## 7.1 Event Catalog

The canonical event type names are defined in `packages/events/src/schemas.ts`.

| Event Type | Payload Shape |
| --- | --- |
| `contact.created` | `contactId`, optional `email`, optional `phone` |
| `contact.updated` | same payload contract as `contact.created` |
| `activity.logged` | `activityId`, optional `contactId`, `kind` |
| `email.sent` | `messageId`, `to`, optional `subject` |
| `task.created` | `taskId` |
| `agent_run.started` | `agentRunId`, `agentId`, `tool` |
| `agent_run.completed` | `agentRunId`, `agentId`, `tool`, `status`, `costCents` |
| `approval.requested` | `approvalId`, `agentRunId` |

## 7.2 Transactional Outbox

Domain writes publish events by inserting into `outbox_event` inside the same
database transaction. Worker behavior:

1. claim unpublished rows
2. convert each row to an event envelope
3. push to Redis Stream `aires:events`
4. publish to Redis channel `aires:events:broadcast`
5. create `webhook_delivery` rows for matching subscriptions
6. mark successful outbox rows as published

## 7.3 SSE Envelope

SSE `data` contains the full envelope:

```json
{
  "id": "event-uuid",
  "type": "email.sent",
  "organizationId": "org-uuid",
  "aggregateType": "email",
  "aggregateId": "sendgrid-message-id",
  "createdAt": "2026-04-19T18:12:00.000Z",
  "payload": {
    "actor": {
      "type": "agent",
      "id": "agent-uuid"
    },
    "messageId": "sendgrid-message-id",
    "to": "buyer@example.com",
    "subject": "Welcome"
  },
  "actor": {
    "type": "agent",
    "id": "agent-uuid"
  }
}
```

## 7.4 Webhook Subscriptions

Subscriptions are created through the tRPC `subscription` router.

Security and delivery behavior:

- production requires `https`
- embedded basic-auth credentials in the URL are rejected
- blocked hostnames include `localhost`, `.local`, `.internal`,
  and `.localhost` in production
- hostnames that resolve to private IP ranges are rejected
- delivery requests include:
  - `x-aires-event`
  - `x-aires-signature`
  - `x-aires-delivery-id`
- signature format is `sha256=<hex-hmac>`
- HMAC body is the exact JSON request body sent to the target
- retries back off exponentially
- default max attempts is 8
- terminal failures move the delivery row to `dlq`

Webhook request body:

```json
{
  "id": "event-uuid",
  "type": "email.sent",
  "organizationId": "org-uuid",
  "payload": {
    "actor": {
      "type": "agent",
      "id": "agent-uuid"
    },
    "messageId": "message-id",
    "to": "buyer@example.com",
    "subject": "Welcome"
  }
}
```

## 8. Workers and External Integrations

`apps/workers` runs a lightweight HTTP health server plus the background loops.

## 8.1 Worker Queues

| Queue | Trigger | External adapter | Behavior |
| --- | --- | --- | --- |
| `email` | `email.send` | SendGrid | Sends email, optionally records CRM activity and emits `email.sent` |
| `sms` | `sms.send` | Aircall | Sends outbound SMS |
| `contracts` | approved or human `contract.send` | DocuSeal | Creates submission for signature |
| `reports` | `report.fetch` | Blackline | Fetches export and returns download URL |

## 8.2 Continuous Loops

| Loop | Purpose |
| --- | --- |
| outbox dispatcher | drains unpublished events to Redis Stream, SSE broadcast, and webhook fan-out |
| webhook deliverer | claims and retries `webhook_delivery` rows until delivered or dead-lettered |

## 9. MCP Server API

Base service: `apps/mcp-server` on `http://localhost:4200`

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| `GET` | `/healthz` | none | Liveness probe |
| `GET` | `/readyz` | none | Readiness probe |
| `GET` | `/sse` | agent JWT | Opens MCP SSE session |
| `POST` | `/message?sessionId=<id>` | same session | Handles MCP client messages |

Runtime behavior:

- one MCP server instance is built per SSE session
- the server fetches the current tool catalog from `apps/core`
- each catalog item is mounted as an MCP tool
- tool input is accepted as a generic object at the MCP layer
- `apps/core` still performs real validation and authorization

## 10. Data Model Snapshot

## 10.1 Identity and Access

| Table | Purpose |
| --- | --- |
| `organization` | Tenant record |
| `member` | User-to-organization membership |
| `project` | Project under an organization |
| `api_key` | Better-Auth API key storage |
| `jwks` | JWT key material for Better-Auth |
| `agent` | Agent identity, scopes, project access, spend/rate settings |
| `agent_token` | Issued short-lived agent JWTs and revocation state |
| `audit_log` | Immutable audit rows for tool and actor operations |

## 10.2 CRM Domain

| Table | Purpose |
| --- | --- |
| `contact` | CRM contact record |
| `activity` | Timeline activity such as call, email, sms, note, meeting |
| `communication` | Provider metadata for email/SMS style communications |
| `task` | CRM tasks |
| `document` | Stored documents and attachments |

## 10.3 Tooling and Approvals

| Table | Purpose |
| --- | --- |
| `tool` | Persisted tool catalog |
| `agent_run` | Execution record for agent tool runs |
| `approval` | Approval queue for high-impact agent actions |

## 10.4 Events and Webhooks

| Table | Purpose |
| --- | --- |
| `outbox_event` | Transactional outbox rows |
| `subscription` | Webhook subscriptions |
| `webhook_delivery` | Durable per-subscription delivery attempts |

## 10.5 RAG and Memory

| Table | Purpose |
| --- | --- |
| `kb_document` | Knowledge base documents |
| `kb_chunk` | Embedded chunks for hybrid search |
| `agent_memory` | Embedded per-agent memory records |

## 11. Environment Variables

Root `.env` is shared across services. Key variables:

| Variable | Required | Used By | Notes |
| --- | --- | --- | --- |
| `POSTGRES_URL` | yes | core, workers, shared packages | Primary database |
| `REDIS_URL` | yes | core, workers, mcp-server via shared behavior | BullMQ, SSE broadcast, streams, rate limits |
| `BETTER_AUTH_SECRET` | yes | core | Better-Auth secret |
| `CORE_PUBLIC_URL` | yes | core | Public auth/JWKS origin |
| `CORE_INTERNAL_URL` | yes for internal consumers | core, mcp-server | Internal base URL to core |
| `CORS_ALLOWED_ORIGINS` | no | core | Extra allowed origins |
| `OPENAI_API_KEY` | optional | core, rag tools | Required for `kb.search`, `memory.*` in practice |
| `SENDGRID_API_KEY` | optional | workers | Enables email worker |
| `SENDGRID_FROM_EMAIL` | optional | workers | Default sender |
| `AIRCALL_API_ID` | optional | workers | Enables SMS worker |
| `AIRCALL_API_TOKEN` | optional | workers | Enables SMS worker |
| `DOCUSEAL_API_KEY` | optional | workers | Enables contract worker |
| `BLACKLINE_API_TOKEN` | optional | workers | Enables reports worker |
| `AUTH_DISCORD_ID` | optional | core | OAuth provider |
| `AUTH_DISCORD_SECRET` | optional | core | OAuth provider |
| `AUTH_GOOGLE_ID` | optional | core | OAuth provider |
| `AUTH_GOOGLE_SECRET` | optional | core | OAuth provider |
| `LOG_LEVEL` | no | all | Defaults to `info` |
| `OTEL_ENABLED` | no | core, workers | Telemetry toggle |
| `PXP_MONGO_URL` | optional | sync CLI | Used for bootstrap tooling only |

## 12. Chat SDK and WhatsApp Integration Extension

This section describes the recommended extension for adding
[`chat-sdk.dev`](https://chat-sdk.dev/docs) to Aires Headless CRM.

Status:

- this is not implemented in the current `aires-turbo` runtime
- it is an integration design for the next channel layer
- older internal notes in `docs/MCP_AND_AGENT_ARCHITECTURE.md` assume a
  Twilio-shaped WhatsApp path; for a Chat SDK-based rollout, the safer target is
  the official [`@chat-adapter/whatsapp`](https://chat-sdk.dev/adapters/whatsapp)
  adapter for Meta WhatsApp Business Cloud API

## 12.1 Recommended package set

Recommended external packages for this integration:

- `chat`
- `@chat-adapter/whatsapp`
- `@chat-adapter/state-redis`
- optional `@chat-adapter/state-pg`

Why this fits the current backend:

- `aires-turbo` already uses Redis, so `@chat-adapter/state-redis` matches the
  current infrastructure
- `apps/core` already centralizes identity, scopes, audit, and tool execution
- `apps/mcp-server` already exists for model-facing workflows, so a new
  Chat SDK process can stay a channel adapter rather than duplicating tool logic

## 12.2 Official Chat SDK capabilities that matter here

The official Chat SDK docs describe WhatsApp support through the
`@chat-adapter/whatsapp` adapter. For Aires, the main behavior to design around
is:

- WhatsApp is supported as a first-party adapter
- DMs and opening DMs are supported
- reactions are supported
- cards are only partially supported
- modals are not supported
- streaming is buffered rather than live token-by-token
- interactive buttons are supported, but only up to 3 reply buttons
- list messages are supported
- message editing and deletion are not supported
- message history fetch is not supported by the Cloud API, so Aires must persist
  all inbound and outbound messages itself
- the documented thread id shape is `whatsapp:{phoneNumberId}:{userWaId}`

For Aires, that means CRM persistence is mandatory rather than optional.

## 12.3 Current backend gaps

Before this integration can be production-ready, the current backend still needs
channel-specific additions.

Not present today in `aires-turbo`:

- no Chat SDK runtime app such as `apps/chat-bots`
- no WhatsApp webhook route in `apps/core`
- no channel thread or channel message tables
- no bot-owned service credential flow for minting agent JWTs as a bot process
- no `activity.kind = "whatsapp"` enum value in the CRM schema

Important schema note:

- current `activity.kind` supports `call`, `email`, `sms`, `note`, `meeting`,
  `visit`, and `task`
- do not overload WhatsApp into `sms` long term
- recommended change: add `whatsapp` as a first-class activity kind and store
  `communication.provider = "whatsapp"`

## 12.4 Recommended service shape

Recommended addition:

- add `apps/chat-bots` as a dedicated Chat SDK process

Recommended responsibilities for that service:

- own Chat SDK adapter initialization
- terminate Meta webhook traffic
- maintain thread subscription state in Redis
- resolve inbound WhatsApp messages to an Aires org, project, contact, and
  assignment owner
- call back into `apps/core` for audit-bound operations and tool execution
- persist every inbound and outbound channel turn into CRM-facing storage

Recommended high-level flow:

1. Meta sends a WhatsApp webhook to `apps/chat-bots`.
2. Chat SDK normalizes the event into a WhatsApp thread and message.
3. `apps/chat-bots` resolves the owning organization and contact by phone.
4. The service decides whether the turn belongs in:
   - a buyer-facing sales rep conversation
   - a manager escalation thread
   - an automation-only path
5. The service invokes Aires workflows through:
   - direct CRM writes for conversation journaling
   - `apps/core` REST or future chat endpoints for tool execution
6. The final reply is posted back through Chat SDK.

## 12.5 Recommended WhatsApp configuration

Recommended environment variables for the WhatsApp adapter:

| Variable | Required | Purpose |
| --- | --- | --- |
| `WHATSAPP_ACCESS_TOKEN` | yes | Meta access token |
| `WHATSAPP_APP_SECRET` | yes | webhook signature verification |
| `WHATSAPP_PHONE_NUMBER_ID` | yes | business phone identity |
| `WHATSAPP_VERIFY_TOKEN` | yes | webhook verification handshake |
| `WHATSAPP_BOT_USERNAME` | no | self-message detection / bot name |
| `REDIS_URL` | yes | Chat SDK state adapter and dedupe state |

Recommended initialization shape:

```ts
import { Chat } from "chat";
import { createWhatsAppAdapter } from "@chat-adapter/whatsapp";
import { createRedisState } from "@chat-adapter/state-redis";

const bot = new Chat({
  userName: process.env.WHATSAPP_BOT_USERNAME ?? "aires-sales",
  adapters: {
    whatsapp: createWhatsAppAdapter(),
  },
  state: createRedisState(),
});
```

Recommended webhook handling shape:

```ts
export async function GET(request: Request) {
  return bot.adapters.whatsapp.handleWebhook(request);
}

export async function POST(request: Request) {
  return bot.adapters.whatsapp.handleWebhook(request);
}
```

## 12.6 Sales rep channel design

Recommended meaning of the sales rep WhatsApp channel:

- this is the buyer or prospect conversation lane
- one external WhatsApp thread maps to one CRM conversation thread
- the primary human owner is the assigned sales rep
- AI can assist, but ownership stays explicit

Recommended rep workflows:

- inbound lead qualification
- FAQ answers about project, pricing bands, floorplans, and inventory status
- appointment scheduling
- follow-up nudges
- rep takeover from automation
- rep handoff to another rep or to a manager

Recommended CRM mapping for each WhatsApp turn:

- resolve or create `contact` by phone number
- create `activity` row with `kind = "whatsapp"` after schema extension
- create `communication` row with `provider = "whatsapp"`
- attach `organizationId`, optional `projectId`, assignment owner, and request id
- write an audit row for any automated action that calls a tool

Recommended rep controls:

- `Take over`
- `Return to AI`
- `Escalate to manager`
- `Assign to rep`
- `Schedule visit`

In WhatsApp itself, these controls should be rendered as short buttons or short
numbered text prompts, because modals and rich admin controls are not available.

## 12.7 Sales manager channel design

Recommended meaning of the sales manager WhatsApp channel:

- this is an operational oversight lane, not the default buyer thread
- use it for approvals, escalations, SLA alerts, reassignment, and daily digest
- treat it as manager-specific direct threads rather than shared group-chat
  workflows

That last point is an inference from the official adapter surface: the
documented WhatsApp adapter explicitly describes DM support and open-DM support,
but does not describe group-thread workflows. For Aires, one-to-one manager
threads are the safer documented model.

Recommended manager workflows:

- approve or reject high-risk replies
- approve price or incentive exceptions
- reassign hot leads between reps
- receive digest summaries for missed or stale conversations
- receive handoff requests from reps
- pause or resume automation on a conversation

Recommended manager interaction pattern:

- keep messages short
- use 3 or fewer quick actions when possible
- use list messages for longer action sets
- fall back to numbered text choices when buttons are too constrained

Example manager escalation card translated for WhatsApp:

```text
Lead wants a same-day pricing exception for Tower 2.

1. Approve exception
2. Call lead now
3. Reassign to me
```

## 12.8 UX constraints from WhatsApp

Design constraints that should be reflected in Aires docs and implementation:

- no edit-in-place after send
- no delete after send
- no modal workflows
- no live token streaming; send buffered completions instead
- use short paragraphs and short bullets
- keep button labels under the documented title limits
- persist complete message history in Aires because the Cloud API does not
  support fetching messages back later
- plan around auto-chunking on long outbound content rather than relying on one
  oversized response

For sales teams, this means:

- the rich operational UI remains in the admin app
- WhatsApp carries compact actions, summaries, alerts, and customer replies
- the CRM remains the system of record

## 12.9 Recommended future scopes and tables

Recommended future scopes for channel operations:

- `chat:read`
- `chat:reply`
- `chat:assign`
- `chat:escalate`
- `chat:approve`

Recommended future tables:

| Table | Purpose |
| --- | --- |
| `channel_account` | per-org channel configuration such as WhatsApp number identity |
| `channel_thread` | canonical thread record keyed by provider thread id |
| `channel_message` | normalized inbound and outbound channel messages |
| `channel_assignment` | current rep or manager owner for a thread |
| `channel_handoff` | explicit handoff and escalation state |
| `channel_digest_subscription` | manager digest and alert preferences |

## 12.10 Official references

- Chat SDK introduction: <https://chat-sdk.dev/docs>
- Adapters overview: <https://chat-sdk.dev/adapters>
- WhatsApp adapter: <https://chat-sdk.dev/adapters/whatsapp>
- WhatsApp adapter directory: <https://chat-sdk.dev/adapters/for/whatsapp>

## 13. Local Development and Smoke Tests

Install and push schema:

```bash
pnpm install
cp .env.example .env
pnpm -F @acme/db push
```

Run services:

```bash
pnpm -F @acme/core dev
pnpm -F @acme/workers dev
pnpm -F @acme/mcp-server dev
pnpm -F @acme/nextjs dev
```

Useful checks:

```bash
curl http://localhost:4000/healthz
curl http://localhost:4100/healthz
curl http://localhost:4200/healthz
```

## 14. Implementation Notes Worth Knowing

- `GET /api/v1/tools` is public; execution is not.
- REST contacts intentionally expose a smaller surface than the tRPC contact
  router.
- `contact.list` accepts a `cursor` field in tRPC input, but the current query
  does not apply cursor pagination yet.
- `tool.catalog` and `tool.inMemory` are discovery endpoints only. They never
  execute tools.
- Better-Auth is configured with an API key plugin, but `apps/core` request
  actor resolution currently centers on session cookies and bearer agent JWTs.
- `contract.send` approval behavior differs by caller type:
  - agent caller: approval flow
  - user caller: direct queue
- `memory.remember` and `memory.recall` are handler-enforced agent-only tools.

## 15. Source Files

If you need to update this document, start with these files:

- `apps/core/src/server.ts`
- `apps/core/src/rest/contact.ts`
- `apps/core/src/rest/tool.ts`
- `apps/core/src/agent-tokens.ts`
- `apps/core/src/sse.ts`
- `packages/api/src/root.ts`
- `packages/api/src/router/*.ts`
- `packages/auth/src/verify-agent-jwt.ts`
- `packages/db/src/schema/*.ts`
- `packages/events/src/*.ts`
- `apps/workers/src/main.ts`
- `apps/workers/src/queues/*.ts`
- `apps/mcp-server/src/server.ts`
- `docs/MCP_AND_AGENT_ARCHITECTURE.md`
