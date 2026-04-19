# Headless CRM — Phase 0 Quickstart

This is the zero-to-green guide for `apps/core`, `apps/workers`, and `apps/mcp-server` on Railway.

## 1. Local boot (sanity)

```bash
pnpm install
pnpm -F @acme/db push   # push the new identity/crm/events/agents/rag schema to a local pg
pnpm -F @acme/core dev  # http://localhost:4000/healthz -> {ok:true}
pnpm -F @acme/workers dev  # http://localhost:4100/healthz
pnpm -F @acme/mcp-server dev  # http://localhost:4200/healthz
```

`.env` (root) must include:

```bash
POSTGRES_URL=postgres://...       # shared by all three
REDIS_URL=redis://localhost:6379  # shared
BETTER_AUTH_SECRET=...
BETTER_AUTH_URL=http://localhost:4000
JWT_ISSUER=aires-crm
CORE_INTERNAL_URL=http://localhost:4000
SENDGRID_API_KEY=...              # optional — worker self-disables if missing
AIRCALL_API_ID=...                # optional
AIRCALL_API_TOKEN=...             # optional
DOCUSEAL_API_KEY=...              # optional
BLACKLINE_API_TOKEN=...           # optional
```

## 2. Railway provisioning

```bash
railway login
railway init aires-crm            # create an empty project
railway add --database postgres   # pg17 + pgvector
railway add --database redis
```

Create three services from this monorepo:

```bash
# repeat for each service
railway service create aires-core      && railway up --service aires-core
railway service create aires-workers   && railway up --service aires-workers
railway service create aires-mcp       && railway up --service aires-mcp
```

Each service points at its own `apps/*/railway.json` for build/health config. Railway references share `POSTGRES_URL` and `REDIS_URL` from the Postgres/Redis plugins into all three services.

## 3. What each service does

| Service     | Port | Purpose                                                                      |
| ----------- | ---- | ---------------------------------------------------------------------------- |
| core        | 4000 | Hono HTTP → tRPC + REST (`/api/v1/...`) + SSE (`/events/stream`) + auth      |
| workers     | 4100 | BullMQ consumers (email/sms/contracts/reports) + outbox dispatcher + webhooks |
| mcp-server  | 4200 | SSE MCP bridge — Claude/Cursor mount this URL and call core tools            |

## 4. Green-path smoke test

```bash
# 1. mint a user, then mint an agent token
curl -X POST $CORE_URL/auth/sign-in/email -d '{...}'
curl -X POST $CORE_URL/api/v1/agents/:id/tokens -H "cookie: ..." -d '{"scopes":["tools:email"]}'

# 2. call a tool as the agent
curl -X POST $CORE_URL/api/v1/tools/email.send \
  -H "authorization: Bearer <agentJwt>" \
  -d '{"to":"me@aires.tech","subject":"ping","text":"pong"}'

# 3. watch it fan out
curl -H "authorization: Bearer <agentJwt>" $CORE_URL/events/stream
```

You should see:

- `audit_log` row (actor=agent)
- `outbox_event` row (`email.sent` after worker picks it up)
- BullMQ `email` queue completion in workers logs
- SSE broadcast of `email.sent` on `/events/stream`

Phase 0 done.
