# Aires Headless CRM — Dev Quickstart

This doc gets you from "fresh clone" to "I can actually chat with the agent" for the `aires-turbo` monorepo. Two paths: **all local** (fastest) and **Railway-deployed frontend + core** (what ships for staff).

## What you're running

| App | Port | Purpose |
|---|---|---|
| `apps/core` | 4000 | Better-Auth, REST + tRPC, tools, SSE |
| `apps/workers` | 4100 | BullMQ queue consumers |
| `apps/mcp-server` | 4200 | MCP bridge (Cursor / Claude Desktop) |
| `apps/agent-harness` | 4300 | Vercel AI SDK — streams agent responses |
| `apps/chat-bots` | 4200 | WhatsApp / Twilio webhook handler |
| `apps/chat-web` | 3100 | Next.js chat UI (the thing staff see) |

To chat in a browser you only need: **core + agent-harness + chat-web + Postgres + Redis**.

---

## Path A — Run everything locally (5-10 min)

### 1. Prereqs

- Node 22+, pnpm 10
- Postgres 16+ on localhost:5432 with pgvector
- Redis 7+ on localhost:6379

If you already have Docker:

```bash
docker run -d --name aires-pg -p 5432:5432 \
  -e POSTGRES_USER=aires -e POSTGRES_PASSWORD=aires -e POSTGRES_DB=aires \
  pgvector/pgvector:pg16
docker run -d --name aires-redis -p 6379:6379 redis:7
```

### 2. Install + env

```bash
cd aires-turbo
pnpm install
cp .env.example .env
```

> Full env var reference (per-service, grouped by integration — email, SMS,
> WhatsApp, DocuSeal, Blackline, LLM providers, etc.): see
> [`docs/ENV_REFERENCE.md`](./ENV_REFERENCE.md).

Edit `.env` (minimum):

```bash
POSTGRES_URL=postgres://aires:aires@localhost:5432/aires
REDIS_URL=redis://localhost:6379

BETTER_AUTH_SECRET=$(openssl rand -base64 48)
CORE_PUBLIC_URL=http://localhost:4000
CORE_INTERNAL_URL=http://localhost:4000

# Agent harness wiring
HARNESS_INTERNAL_URL=http://localhost:4300
MCP_SERVER_URL=http://localhost:4200
AGENT_DEFAULT_MODEL=claude          # or gpt / gemini
ANTHROPIC_API_KEY=sk-ant-...        # at least one provider key

# Chat-web wiring (filled in after the seed step below)
SINGLE_ORG_ID=                      # set by scripts/seed-dev-user.ts
DEFAULT_AGENT_ID=                   # set by scripts/seed-dev-user.ts
CHAT_WEB_BASE_URL=http://localhost:3100
```

### 3. Push schema

```bash
pnpm -F @acme/db push
```

### 4. Boot core in one terminal

```bash
pnpm -F @acme/core dev
# -> listening on :4000, /healthz returns {ok:true}
```

### 5. Seed your dev user

In a second terminal:

```bash
SEED_EMAIL="michael@aires.ai" \
SEED_PASSWORD="ChangeMe!23" \
SEED_NAME="Michael Moll" \
SEED_ORG_NAME="Aires" \
pnpm -F @acme/core tsx scripts/seed-dev-user.ts
```

This:

- creates a Better-Auth email+password user
- creates an `Aires` organization + your owner membership
- creates a default agent
- prints `SINGLE_ORG_ID=...` and `DEFAULT_AGENT_ID=...` — paste those into `.env`

### 6. Boot the rest

```bash
pnpm -F @acme/agent-harness dev   # :4300
pnpm -F @acme/chat-web dev        # :3100
```

### 7. Sign in

- Open http://localhost:3100/login
- Email: `michael@aires.ai`
- Password: (whatever you set as `SEED_PASSWORD`)
- You'll land on `/chat/th_<uuid>` — start typing.

---

## Path B — Railway-deployed core + chat-web (staff-facing)

The Railway project `aires-headless-crm` already has Postgres, Redis, `core`, `mcp-server`, and `workers` running. What's left to deploy for a usable staff UI:

### 1. Deploy `agent-harness`

```bash
railway link                      # pick: aires-headless-crm
railway service create agent-harness
railway up --service agent-harness --detach
```

Then set env vars on the new `agent-harness` service (via dashboard or `railway variables set`):

```bash
NIXPACKS_START_CMD="pnpm -F @acme/agent-harness start"
PORT=8080

REDIS_URL=$Redis.REDIS_URL
CORE_INTERNAL_URL=http://core.railway.internal:8080   # private URL
MCP_SERVER_URL=http://mcp-server.railway.internal:8080
BETTER_AUTH_SECRET=${shared with core}
SINGLE_ORG_ID=${from seed output}

AGENT_DEFAULT_MODEL=claude
ANTHROPIC_API_KEY=...
# OPENAI_API_KEY=...  (optional)
# GOOGLE_GENERATIVE_AI_API_KEY=...  (optional)
```

### 2. Deploy `chat-web`

```bash
railway service create chat-web
railway up --service chat-web --detach
```

Env vars for `chat-web`:

```bash
NIXPACKS_START_CMD="pnpm -F @acme/chat-web start"
PORT=8080

AUTH_SECRET=${shared with core AUTH_SECRET}
BETTER_AUTH_SECRET=${shared with core}

CORE_INTERNAL_URL=http://core.railway.internal:8080
HARNESS_INTERNAL_URL=http://agent-harness.railway.internal:8080

SINGLE_ORG_ID=${from seed output}
DEFAULT_AGENT_ID=${from seed output}

CHAT_WEB_BASE_URL=https://chat-web-production-<...>.up.railway.app
CHAT_WEB_PRODUCTION_URL=https://chat-web-production-<...>.up.railway.app
```

### 3. Seed your user on the deployed core

Two options:

**Option A — tunnel + run the seed locally against Railway Postgres:**

```bash
railway run --service core -- bash -c 'echo $POSTGRES_URL'
# copy that URL into your local shell
POSTGRES_URL=postgres://... \
CORE_URL=https://core-production-19db.up.railway.app \
SEED_EMAIL="michael@aires.ai" \
SEED_PASSWORD="ChangeMe!23" \
pnpm -F @acme/core tsx scripts/seed-dev-user.ts
```

**Option B — one-shot from the Railway shell:**

```bash
railway shell --service core
# inside the shell:
SEED_EMAIL="michael@aires.ai" \
SEED_PASSWORD="ChangeMe!23" \
pnpm -F @acme/core tsx scripts/seed-dev-user.ts
```

Then copy the printed `SINGLE_ORG_ID` + `DEFAULT_AGENT_ID` into `agent-harness` and `chat-web` env vars and redeploy those two services.

### 4. Sign in

- Visit the `chat-web` public URL + `/login`
- Email / password you set in step 3

---

## Common gotchas

| Symptom | Fix |
|---|---|
| Login form returns "Sign-in failed" | `chat-web` and `core` must share the same `BETTER_AUTH_SECRET` + `AUTH_SECRET`. On Railway, reference them as shared env across both services. |
| `/api/chat` returns 502 | `HARNESS_INTERNAL_URL` points at the wrong host or `agent-harness` isn't booted. |
| Stream starts then cuts off | You haven't set a provider key (`ANTHROPIC_API_KEY` etc.) on `agent-harness`, or the chosen `AGENT_DEFAULT_MODEL` doesn't match the key you set. |
| Empty thread list | First message hasn't landed yet. `chat_thread` is written on first user turn. |
| CORS errors from the login form | `CORE_PUBLIC_URL` on `core` must match the origin your browser loads (for path B that means set `CORE_PUBLIC_URL` to the deployed `chat-web` URL and add it to `CORS_ALLOWED_ORIGINS`). |

---

## Rotating the seeded password

```bash
# While signed in, call Better-Auth's change-password route:
curl -X POST https://core-.../api/auth/change-password \
  -H "cookie: better-auth.session_token=..." \
  -H "content-type: application/json" \
  -d '{"currentPassword":"ChangeMe!23","newPassword":"<new>"}'
```

Or re-run the seed script with a different `SEED_PASSWORD` after deleting the user from the `user` table.
