# Environment Variable Reference

One page, all envs, grouped by purpose, with a "which app needs it" matrix so you can paste the right block into each Railway service.

Legend: **R** required, **O** optional, *blank* = not used by that app.

---

## 1. Core infra (databases)

| Var | core | workers | mcp-server | agent-harness | chat-web | chat-bots |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| `POSTGRES_URL` | R | R |  |  |  |  |
| `DATABASE_URL` | R\* | R\* |  |  |  |  |
| `REDIS_URL` | R | R |  | R |  | R |

\* Either works; keep them identical. Drizzle Kit uses `DATABASE_URL`, everything else uses `POSTGRES_URL`.

---

## 2. Auth (shared across every browser-facing service)

| Var | core | chat-web | agent-harness | chat-bots |
|---|:-:|:-:|:-:|:-:|
| `BETTER_AUTH_SECRET` | R | R (as `AUTH_SECRET`) | R | R |
| `AUTH_SECRET` |  | R |  |  |
| `CORE_PUBLIC_URL` | R |  |  |  |
| `CHAT_WEB_BASE_URL` |  | R |  |  |
| `CHAT_WEB_PRODUCTION_URL` |  | R |  |  |
| `AUTH_GOOGLE_ID` | O | O |  |  |
| `AUTH_GOOGLE_SECRET` | O | O |  |  |
| `AUTH_DISCORD_ID` | O |  |  |  |
| `AUTH_DISCORD_SECRET` | O |  |  |  |
| `CORS_ALLOWED_ORIGINS` | O |  |  |  |

Rule: the Better-Auth secret MUST be byte-identical on every service that validates sessions. Rotate = redeploy all of them.

---

## 3. Service-to-service URLs

| Var | Who reads it | Dev value | Railway value |
|---|---|---|---|
| `CORE_INTERNAL_URL` | workers, mcp-server, agent-harness, chat-bots, chat-web | `http://localhost:4000` | `http://core.railway.internal:8080` |
| `HARNESS_INTERNAL_URL` | chat-web, chat-bots | `http://localhost:4300` | `http://agent-harness.railway.internal:8080` |
| `MCP_SERVER_URL` | agent-harness | `http://localhost:4200` | `http://mcp-server.railway.internal:8080` |
| `CHAT_BOTS_INTERNAL_URL` | core | `http://localhost:4400` | `http://chat-bots.railway.internal:8080` |

---

## 4. Tenant

| Var | core | workers | agent-harness | chat-bots |
|---|:-:|:-:|:-:|:-:|
| `SINGLE_ORG_ID` | R | R | R | R |
| `DEFAULT_AGENT_ID` | R |  | R |  |

Both come from `pnpm -F @acme/core tsx scripts/seed-dev-user.ts`.

---

## 5. LLM providers

You need **at least one** provider key, and `AGENT_DEFAULT_MODEL` must match it.

| Var | agent-harness | core (embeddings / tools) |
|---|:-:|:-:|
| `AGENT_DEFAULT_MODEL` | R |  |
| `ANTHROPIC_API_KEY` | O |  |
| `OPENAI_API_KEY` | O | R (for KB search + memory) |
| `GOOGLE_GENERATIVE_AI_API_KEY` | O |  |
| `FF_AGENT_MODEL_OVERRIDE` | O |  |
| `CHAT_THREAD_MAX_MESSAGES` | O |  |
| `AGENT_JWT_TTL_SECONDS` | O |  |

Note: core's KB search and memory tools call `OpenAI` for embeddings. If you want a pure-Anthropic setup, leave those tools disabled or swap the embedding provider in `apps/core/src/tools/kb-search.ts` and `memory-remember.ts`.

---

## 6. Email — SendGrid

| Var | workers |
|---|:-:|
| `SENDGRID_API_KEY` | O (queue self-disables if blank) |
| `SENDGRID_FROM_EMAIL` | O |

Consumed by `apps/workers/src/queues/email.ts`. The email tool on the core side enqueues jobs regardless; the worker is what actually sends.

---

## 7. Voice & SMS — Aircall

| Var | workers |
|---|:-:|
| `AIRCALL_API_ID` | O |
| `AIRCALL_API_TOKEN` | O |

Used by `apps/workers/src/queues/sms.ts` and any outbound call tool. Queue self-disables if either is blank.

---

## 8. WhatsApp / SMS inbound — Twilio + chat-bots

| Var | core | chat-bots |
|---|:-:|:-:|
| `TWILIO_ACCOUNT_SID` |  | O |
| `TWILIO_AUTH_TOKEN` | R\* | O |
| `TWILIO_WHATSAPP_FROM` |  | O |
| `BOT_AGENT_ID` |  | R |
| `BOT_API_KEY` |  | R |
| `BOT_INTERNAL_SECRET` | R | R |

\* core only needs `TWILIO_AUTH_TOKEN` to verify inbound webhook signatures. If you leave it blank in dev, webhook signature verification is skipped.

`BOT_AGENT_ID` + `BOT_API_KEY` authenticate chat-bots → core as an agent actor. Mint via:
```
POST /api/v1/agents            (body: {name: "chat-bots-runtime", scopes: ["tools:*"]})
POST /api/v1/agents/:id/api-keys
```
`BOT_INTERNAL_SECRET` is the HMAC shared secret for core → chat-bots internal calls (16+ bytes, any random string).

---

## 9. Contracts — DocuSeal

| Var | workers |
|---|:-:|
| `DOCUSEAL_API_KEY` | O |

Queue `apps/workers/src/queues/contracts.ts` self-disables if blank.

---

## 10. Reports — Blackline

| Var | workers |
|---|:-:|
| `BLACKLINE_API_TOKEN` | O |

Queue `apps/workers/src/queues/reports.ts` self-disables if blank.

---

## 11. Observability

| Var | All apps |
|---|:-:|
| `LOG_LEVEL` | O (default `info`) |
| `OTEL_ENABLED` | O |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | O |

---

## Which service needs which block

Quick copy-paste grouping if you're filling Railway one service at a time.

### `core`
§1 (Postgres, Redis) · §2 (Better-Auth + Google/Discord) · §3 (`CORE_INTERNAL_URL` self-ref, `CHAT_BOTS_INTERNAL_URL`) · §4 (`SINGLE_ORG_ID`, `DEFAULT_AGENT_ID`) · §5 (`OPENAI_API_KEY` for KB) · §8 (`TWILIO_AUTH_TOKEN`, `BOT_INTERNAL_SECRET`) · §11

### `workers`
§1 · §4 (`SINGLE_ORG_ID`) · §6 · §7 · §9 · §10 · §11

### `mcp-server`
§1 (Redis only) · §3 (`CORE_INTERNAL_URL`) · §11

### `agent-harness`
§1 (Redis) · §2 (`BETTER_AUTH_SECRET`) · §3 (`CORE_INTERNAL_URL`, `MCP_SERVER_URL`) · §4 (`SINGLE_ORG_ID`, `DEFAULT_AGENT_ID`) · §5 (provider keys + `AGENT_DEFAULT_MODEL`) · §11

### `chat-web`
§2 (`AUTH_SECRET`, `CHAT_WEB_BASE_URL`, optional Google) · §3 (`CORE_INTERNAL_URL`, `HARNESS_INTERNAL_URL`) · §11

### `chat-bots`
§1 (Redis) · §2 (`BETTER_AUTH_SECRET`) · §3 (`CORE_INTERNAL_URL`, `HARNESS_INTERNAL_URL`) · §4 (`SINGLE_ORG_ID`) · §8 (Twilio + bot creds) · §11

---

## Generate the secrets

```bash
# Better-Auth secret (48 bytes, base64)
openssl rand -base64 48

# BOT_INTERNAL_SECRET (24 bytes, hex)
openssl rand -hex 24
```

Then mint a bot API key:
```bash
# After seeding, sign in as michael@aires.ai, then:
curl -X POST "$CORE/api/v1/agents" \
  -H "content-type: application/json" \
  -H "cookie: $SESSION_COOKIE" \
  -d '{"name":"chat-bots-runtime","scopes":["tools:*"]}'

curl -X POST "$CORE/api/v1/agents/$AGENT_ID/api-keys" \
  -H "cookie: $SESSION_COOKIE"
# → copy `secret` into BOT_API_KEY and `id` into BOT_AGENT_ID
```
