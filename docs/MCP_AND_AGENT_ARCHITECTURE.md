# MCP + Agent Architecture (Aires Headless CRM)

> Formalises the tool-discovery and auth model for the agent surface. Read
> this before touching `apps/mcp-server`, `apps/agent-harness`, `apps/chat-web`,
> `apps/chat-bots`, `packages/mcp-client`, or `apps/core/src/tools/`.
>
> **Tenancy:** Single-tenant at launch. One Better-Auth organization is
> seeded from `SINGLE_ORG_ID`. All multi-tenant primitives (`org_id`
> everywhere, membership checks, scope aliases) remain in place — flipping
> to multi-tenant is a config change, not a rewrite.

---

## 1. How an agent connects — one MCP server, many tools

The answer is **many granular tools behind one MCP server**. That is the
whole point of MCP: the LLM's first call is `list_tools`, it reads each
schema, and invokes typed tools. A single "do_anything" tool with a
natural-language argument is the anti-pattern — we lose validation,
tracing, rate-limiting, and scope enforcement.

```
                agent run
                   │
                   ▼
          ┌──────────────────┐
          │  apps/mcp-server │   MCP protocol (SSE transport)
          │   (1 endpoint)   │
          └────────┬─────────┘
                   │ for each tool call
                   ▼
       ┌───────────────────────────────┐
       │  apps/core  /v1/tools/invoke  │
       │  + scope middleware           │
       │  + audit log                  │
       │  + rate limit                 │
       └───────────────┬───────────────┘
                       │
         ┌─────────────┼─────────────┐
         ▼             ▼             ▼
     email.send   contract.send   report.fetch   … ~40-60 tools
```

Current catalog (as of Phase 0, pre-Phase-1):
`email.send`, `sms.send`, `contract.send`, `report.fetch`, `kb.search`,
`memory.remember`, `memory.recall`.

Each phase (1-7) appends to the catalog: contacts, inventory, transactions,
contracts, campaigns, calls, workflows, reports. Phase 8 consumes the full
surface without adding more tools.

### 1.1 Tool registration contract

Every tool is registered in `apps/core/src/tools/<tool>.ts` and wired in
`apps/core/src/tools/index.ts`. A registration is the Zod input schema, the
Zod output schema, the scope string, an optional approval guard, and a
handler:

```ts
registerTool({
  name: "contract.send",
  description: "Kick off a DocuSeal signing session for a transaction.",
  inputSchema: ContractSendRequestSchema,
  outputSchema: ContractSendResponseSchema,
  scope: "contract:send",
  requiresApproval: true,               // writes that touch external systems
  handler: async ({ input, actor, run }) => { /* ... */ },
});
```

MCP exposes the tool as `name` + `description` + JSON Schema (derived from
the Zod input). The handler never talks to MCP — it receives a validated
`input`, a scoped `actor` (always `type: "agent"` from the MCP path), and
the `run` for audit correlation.

### 1.2 Naming convention (from `apps/core/src/lib/scope.ts`)

- `resource.verb` with dot separator: `contact.upsert`, `workflow.start`.
- Verbs: `search`, `get`, `list`, `create`, `upsert`, `update`, `cancel`,
  `send`, `fetch`, `record`, `issue`, `start`, `status`.
- Scopes mirror the tool name with a colon: `contract:send`, `report:fetch`.
- Legacy aliases (e.g. `reports:read` → `report:fetch`) are bidirectional
  and defined in one place. No inline string compares.

### 1.3 Response contract

Every tool returns `{ data, warnings?, audit: { runId, toolCallId } }`. The
MCP server wraps this into an MCP `content: [{ type: "text", text: ... }]`
block. The harness parses that back into structured JSON for the LLM.

---

## 2. Auth model — one JWKs, three tokens

Better-Auth signs everything with a single JWKs endpoint. Three token
shapes share one trust root:

| Token | Who holds it | Used by | TTL | Minted by |
|-------|--------------|---------|-----|-----------|
| **User session** | Human user | apps/chat-web, apps/nextjs | 7 d | Better-Auth cookie flow |
| **API key** | Server-to-server | apps/chat-bots → apps/agent-harness | rotatable (1y) | `auth.api.apiKey.*` |
| **Agent JWT** | One per agent run | apps/mcp-server + /v1/tools/invoke | 15 min | `apps/core /agents/:id/tokens` |

### 2.1 Agent JWT claims

Every agent JWT is signed by Better-Auth's JWT plugin and carries:

```json
{
  "sub": "<agent_id>",
  "subject_type": "agent",
  "agent_id": "<agent_id>",
  "org_id": "<organization_id>",
  "scopes": ["contact:read", "contract:send", "report:fetch", "..."],
  "project_ids": ["..."] | null,
  "jti": "<uuid>",
  "exp": <unix + 900>
}
```

`jti` is inserted into `agent_token` on mint so revocation = DB row delete.
`verifyAgentJwt` in `packages/auth/src/verify-agent-jwt.ts` validates the
signature against Better-Auth's JWKs, confirms the `jti` is still active,
and returns the parsed claims.

### 2.2 Flow — a tool call from a web chat message

```
chat-web (user session cookie)
      │  POST /v1/runs { agentId, message }
      ▼
apps/agent-harness
      │  confirms Better-Auth session
      │  POST /v1/agents/:id/tokens  (user session auth)
      ▼
apps/core  — mints Agent JWT (15m, scoped)
      │  returns { token, jti, expiresAt }
      ▼
apps/agent-harness
      │  opens MCP client with { Authorization: Bearer <agent jwt> }
      ▼
apps/mcp-server
      │  on each tool.call, verifyAgentJwt(jwt)
      │  → { orgId, agentId, scopes, projectIds, runId }
      │  → POST apps/core /v1/tools/invoke (Bearer jwt)
      ▼
apps/core
      │  requireScope("contract:send")  ← throws 403 if missing
      │  audit.log { runId, agentId, tool, input }
      │  rate-limit.check(agentId, tool)
      │  approval.maybeRequest(runId, tool)  ← pauses run if writes + strict
      │  handler({ input, actor, run })
      ▼
  result → MCP → harness → chat-web (streamed)
```

### 2.3 Bot flow (WhatsApp)

> Note:
> This subsection predates the current official Chat SDK WhatsApp Business Cloud
> adapter. For the current recommended Aires integration shape, see
> `docs/HEADLESS_CRM_API_REFERENCE.md`, section "Chat SDK and WhatsApp
> Integration Extension", which targets `@chat-adapter/whatsapp` over Meta's
> WhatsApp Business Cloud API rather than the older Twilio-shaped path below.

Bots never mint their own JWT from user input. The bot process has its own
Better-Auth **API key** (a separate `apiKeyAgent` seed-row per bot) and
mints agent JWTs as itself, so each inbound message becomes a run with
`agent_id = wa_bot_<org>` and its own `run_id`.

Twilio webhook signature verification happens **before** enqueue:

```
Twilio → POST /webhooks/whatsapp (apps/core)
          ├─ verify X-Twilio-Signature HMAC-SHA1 against TWILIO_AUTH_TOKEN
          ├─ enqueue BullMQ chat-bots:whatsapp:ingest
          └─ 200 within 200ms
```

The queue consumer (`apps/workers/src/queues/chat-bots.ts`) forwards the
already-verified message to `apps/chat-bots` which mints its bot JWT and
calls the harness.

### 2.4 Session cookies vs. API keys vs. agent JWT — one-line rule

> **Users own sessions. Bots own API keys. Runs own agent JWTs.**
>
> If a human is talking, you hold a session. If a process is talking on its
> own behalf, it holds an API key. If an LLM is calling a tool, it holds an
> agent JWT — minted, bound to one run, short-lived, and dropped at
> completion.

---

## 3. Agent harness — provider swap

`apps/agent-harness` is a Next.js app that uses Vercel AI SDK's
`streamText` with provider selection at the call site:

```ts
import { streamText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import { google } from "@ai-sdk/google";

const providers = {
  claude: () => anthropic("claude-sonnet-4-5"),
  gpt:    () => openai("gpt-5"),
  gemini: () => google("gemini-2.5-pro"),
} as const;

const result = await streamText({
  model: providers[run.provider](),
  tools: await loadMcpTools({ mcpClient, agentJwt }),
  messages: await loadHistory(run.threadId),
});
```

`loadMcpTools` is `packages/mcp-client`. It wraps AI SDK's
`experimental_createMCPClient`, calls `tools()` on it, and hands the
resulting tool map straight to `streamText`. No custom bridge is needed;
AI SDK is MCP-native as of `ai@4.x`.

Provider selection precedence:

1. `x-aires-model` header on `/v1/runs` (dev override, gated by
   `FF_AGENT_MODEL_OVERRIDE`).
2. `botConfig.defaultModel` for that org.
3. `AGENT_DEFAULT_MODEL` env var.
4. Hard default: `claude`.

### 3.1 Session state

Redis keys:

- `chat:thread:<threadId>` → list of messages (JSON) — bounded by
  `CHAT_THREAD_MAX_MESSAGES` (default 100).
- `chat:run:<runId>` → run metadata (provider, status, started_at).
- `chat:ratelimit:<agentId>:<toolName>` → token bucket counters.

Persistent audit of what actually ran lives in Postgres (`agent_run`,
`agent_run_step` tables, already defined in `packages/db/src/schema.ts`).

### 3.2 Approval gate

Tools marked `requiresApproval: true` call `requestApproval` from
`@acme/agents/approvals` before executing. The harness pauses the run,
streams an approval card to the chat surface, and waits on a Redis
subscription keyed by `approval:<id>`. Human approves via admin UI or chat
button → harness resumes the run.

---

## 4. Chat surfaces

### 4.1 apps/chat-web (Next.js 15, shadcn)

- Better-Auth login wall. Single seeded org. No org picker in v1.
- `useChat({ api: "/v1/runs" })` hitting the harness through Next.js
  rewrites.
- Renders:
  - Streamed assistant text with Markdown.
  - Tool invocation cards: name, input preview, expandable result.
  - Approval cards with Approve / Deny buttons (wire to
    `/v1/approvals/:id`).
  - Rate-limit messages as inline warnings, not errors.
- Accessibility: ARIA live region on streaming content, keyboard nav on
  cards.

### 4.2 apps/chat-bots (Hono on Node, Chat SDK)

> Note:
> The package and transport assumptions below are historical. The current
> recommended documentation target for a Chat SDK rollout is the official
> `@chat-adapter/whatsapp` adapter documented at `https://chat-sdk.dev`.

- One process, multiple adapters. v1 ships **WhatsApp** via Twilio.
  Slack / Teams / Discord deferred.
- Uses `@vercel/chat-sdk` with `createWhatsAppAdapter({ twilio })` and the
  Redis state layer (same Redis as BullMQ, different keyspace
  `chatsdk:*`).
- For each inbound message, mints a bot agent JWT via its API key and
  calls the harness with `x-aires-bot-id: wa_bot_<org>`.

---

## 5. Security invariants

1. **Never accept an agent JWT in a URL.** `apps/mcp-server` only reads
   `Authorization: Bearer`. (High 5 audit fix, already landed.)
2. **Every tool has a scope.** No scope = boot fails in `registerTool`.
3. **Every mutating tool is audit-logged.** `auditLog` row with runId +
   agentId + input hash is a precondition to the handler running.
4. **No tokens in server logs.** JWTs are redacted by the Pino serializer.
5. **Webhook signatures verified BEFORE any other work.** Twilio, DocuSeal,
   SendGrid — all signature-verified in the public webhook route, before
   enqueue or DB write.
6. **SSRF guard on webhook subscriptions.** Already enforced in
   `packages/api/src/webhook-security.ts`.
7. **CORS allowlist.** `apps/core/src/server.ts` reflects only explicitly
   allowed origins. No wildcard.
8. **Per-run JWT revocation.** Deleting the `agent_token` row invalidates
   the JWT on the next call (jti check).
9. **Approval gate strict default.** `FF_APPROVAL_GATE_STRICT` on by
   default once Phase 6 lands. Any `:write` or `:execute` tool requires a
   human approval.

---

## 6. Single-tenant → multi-tenant migration

At launch, single-tenant is enforced by:

- `SINGLE_ORG_ID` env var read by harness + chat-web + chat-bots.
- chat-web omits org picker.
- Bot config seeded once per env.

To move to multi-tenant:

1. Delete the `SINGLE_ORG_ID` short-circuit in harness.
2. Surface an org picker in chat-web after login (data is already there —
   Better-Auth memberships + `organization` table).
3. Per-channel bot config already keyed by `org_id`, so adding new orgs =
   new `botConfig` rows.

No schema migrations required — every table already has `org_id`.

---

## 7. What ships in Phase 8

| Package / App | What it does |
|---|---|
| `packages/mcp-client` | Typed wrapper around `experimental_createMCPClient` that injects agent JWT, exposes AI SDK-compatible tools, translates errors |
| `packages/kv` | Shared Redis client factory (reused by BullMQ + chat state) |
| `apps/agent-harness` | AI SDK + provider swap + MCP client + Redis sessions + approval gate |
| `apps/chat-web` | Next.js chat UI with Better-Auth + useChat + shadcn |
| `apps/chat-bots` | Hono + Chat SDK + WhatsApp adapter + Twilio webhook |
| `apps/core/src/webhooks/whatsapp.ts` | Public webhook route with Twilio signature verification |
| `apps/workers/src/queues/chat-bots.ts` | BullMQ consumer for verified bot messages |
| Schema additions | `ChatRun`, `ChatMessage`, `botConfig` tables |
| Scopes | `chat:start`, `chat:read` |
| Feature flags | `FF_CHAT_SURFACES`, `FF_AGENT_MODEL_OVERRIDE` |

---

## 8. Out of scope for Phase 8

- Voice chat (Twilio Voice, Retell). Covered later as an extension of
  Phase 5's telephony stack.
- Slack / Teams / Discord adapters. Follow-up sprint after WhatsApp soaks.
- RAG in the prompt context. `packages/rag` already exists; weaving it
  into the harness system prompt is a separate step.
- Multi-agent runs (supervisor + subagents). Design is compatible with it
  — one MCP server, N JWTs, N runs — but shipping with one-agent-per-run
  for v1.
