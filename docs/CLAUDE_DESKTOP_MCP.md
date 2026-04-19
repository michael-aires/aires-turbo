# Connecting Claude Desktop to Aires MCP

Aires' MCP server exposes the same tool catalog as core's REST API
(`email.send`, `kb.search`, `memory.remember`, …) over SSE — so any MCP
client (Claude Desktop, Cursor, Zed, custom) can drive the CRM.

## 1. Mint an agent JWT

```bash
curl -X POST "$CORE_URL/api/v1/agents/$AGENT_ID/tokens" \
  -H "cookie: $SESSION_COOKIE" \
  -H "content-type: application/json" -d '{}'
# -> { "token": "eyJ...", "expiresAt": "...", "scopes": [...] }
```

Copy the `token` value — it's valid for 15 minutes by default. In production
wrap this in a small refresh script that re-mints before expiry.

## 2. Configure Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "aires-crm": {
      "url": "https://aires-mcp.up.railway.app/sse?token=eyJ..."
    }
  }
}
```

For local dev:

```json
{
  "mcpServers": {
    "aires-crm-local": {
      "url": "http://localhost:4200/sse?token=eyJ..."
    }
  }
}
```

Restart Claude Desktop. The Aires tools should appear under the attachments
menu, each named after its catalog entry (`email.send`, `contact.create`,
`kb.search`, …).

## 3. Smoke test

In Claude, prompt:

> Use the `email.send` tool to email me@aires.tech a subject line "mcp smoke"
> and body "hello from aires mcp"

Watch for:

- `audit_log` row (actor=agent, action=`tool.email.send`)
- BullMQ `email` queue job processed by `apps/workers`
- SSE broadcast of `email.sent` on `core`'s `/events/stream`

If anything fails, `apps/mcp-server/logs` surfaces each tool invocation and
the HTTP status returned from `core`.
