# Aires Headless CRM Code Audit

Date: 2026-04-18

## What This Repo Is, In My Opinion

This repo is an agent-first CRM control plane. The real product is not the Next.js UI or the Expo app; it is the backend contract that lets AI agents act inside a multi-tenant CRM with scoped credentials, audited tool execution, async side effects, and integrations like SendGrid, Aircall, DocuSeal, and Blackline.

The monorepo is trying to separate concerns cleanly:

- `apps/core` is the synchronous gateway for auth, REST, tRPC, and tool calls.
- `apps/workers` is the async execution plane for email, SMS, contracts, reports, outbox drain, and webhooks.
- `apps/mcp-server` is a bridge that exposes the tool catalog over MCP for external AI clients.
- `packages/*` hold the shared contracts, DB schema, event bus, auth helpers, RAG, and integrations.

The intent is solid. The current implementation is not yet trustworthy as a multi-tenant production system.

## Executive Summary

Overall rating: **high architectural promise, low current production readiness**

What is good:

- The repo has a coherent service split and shared package model.
- Env validation exists in the main apps.
- The tool registry pattern is sensible.
- The transactional outbox direction is correct.
- Most files are reasonably small and readable.

What is not good:

- Tenant isolation is not enforced consistently. In several places it is effectively user-input-driven.
- The event/SSE/webhook plane has severe authorization and concurrency flaws.
- Some core async tool flows are structurally broken because producer and consumer payloads do not match.
- Verification is weak: `typecheck` fails, `lint` is not healthy, and automated test coverage is extremely thin.

## Verification I Ran

- `pnpm -C aires-turbo -F @acme/core test`
  - Passed: 8 tests in `apps/core/tests/scope.test.ts`
- `pnpm -C aires-turbo typecheck`
  - Failed in worker/events paths, including unresolved exports for `activity`, `communication`, `outboxEvent`, `subscription`, and `webhookDelivery`
- `pnpm -C aires-turbo lint`
  - Failed broadly
  - Some failures were environment-related because the workspace wants Node `^22.21.0` and the current shell is on Node `v20.19.0`
  - Some failures are repo issues, including missing ESLint flat configs in multiple packages and TypeScript portability errors in `packages/api`

## Strengths

- The codebase is easy to navigate for a monorepo of this size.
- Shared packages are used in a way that should reduce duplication once the contracts stabilize.
- The idea of forcing agent actions through audited, typed tools is strong.
- The repo already shows awareness of revocable short-lived JWTs, approvals, outbox, and observability.

## Findings

### Critical 1: Cross-tenant authorization is broken across tRPC and the admin UI

The dominant authorization pattern is: accept `organizationId` from the client, then query directly against it. There is no membership check tying that organization to the authenticated user.

Evidence:

- `packages/api/src/router/contact.ts:11-41`
- `packages/api/src/router/activity.ts:11-33`
- `packages/api/src/router/task.ts:10-33`
- `packages/api/src/router/audit.ts:10-47`
- `packages/api/src/router/subscription.ts:10-58`
- `packages/api/src/router/agent.ts:10-79`
- `apps/core/src/rest/contact.ts:13-30`
- `apps/nextjs/src/app/contacts/page.tsx:10-47`
- `apps/nextjs/src/app/audit/page.tsx:10-57`
- `apps/nextjs/src/app/webhooks/page.tsx:14-49`

Impact:

- Any authenticated user who can guess or obtain another org UUID can list contacts, create contacts in another org, inspect audit logs, list agents, create agents, create webhook subscriptions, or toggle another org’s subscription state.
- ID-based procedures like `contact.byId`, `agent.byId`, `agent.tokens`, `agent.revokeToken`, `task.setStatus`, and `subscription.setActive` also lack ownership or org scoping checks.

Recommendation:

- Introduce a single server-side org authorization layer in tRPC.
- Derive the caller’s allowed orgs from session membership, not URL params.
- Remove raw `organizationId` from most client-facing procedures, or validate it against a membership lookup before any query executes.
- Add row-level authorization checks for every ID-based mutation/query.

### Critical 2: SSE leaks events across tenants

The SSE endpoint authenticates the caller, but then subscribes to the global Redis broadcast channel and forwards every envelope without checking org or project.

Evidence:

- `apps/core/src/sse.ts:9-25`
- `packages/events/src/stream.ts:92-116`

Impact:

- Any authenticated actor can receive every broadcast event emitted by the system, including events from other organizations.

Recommendation:

- Filter before writing the event to the stream.
- Compare the envelope organization/project against the authenticated actor.
- Consider per-org channels rather than a single global broadcast topic.

### Critical 3: Webhook delivery and outbox dispatch are not safe for horizontal scale

The comments claim row-level locking and safe horizontal scaling, but the code does not claim rows atomically.

Evidence:

- `packages/events/src/webhook-delivery.ts:52-177`
- `apps/workers/src/webhook-deliverer.ts:6-10`
- `packages/events/src/outbox.ts:60-107`
- `apps/workers/src/outbox-dispatcher.ts:12-58`

Problems:

- `deliverNext()` does a plain `select ... limit 1`, then performs delivery, then updates the row later.
- `drainOutbox()` selects unpublished rows without any claim/lock step before pushing them.
- `fanOut()` inserts delivery rows without a uniqueness guard on `(subscriptionId, outboxEventId)`.

Impact:

- Multiple worker replicas can deliver the same webhook more than once.
- Multiple dispatcher replicas can push the same outbox event multiple times and create duplicate delivery rows.
- The current comments overstate safety and could lead to false operational confidence.

Recommendation:

- Use `FOR UPDATE SKIP LOCKED` or an atomic update-returning claim step.
- Add an explicit `processing` or `claimedAt/claimedBy` state.
- Add a unique constraint for one delivery row per `(subscriptionId, outboxEventId)`.
- Make the outbox dispatcher idempotent under concurrent workers.

### Critical 4: `contract.send` and `report.fetch` are structurally broken

The core tool input shapes do not match what the workers/integrations expect.

Evidence:

- `apps/core/src/tools/contract-send.ts:15-28`
- `packages/integrations/src/types.ts:42-50`
- `apps/workers/src/queues/contracts.ts:20-28`
- `apps/core/src/tools/report-fetch.ts:13-18`
- `packages/integrations/src/types.ts:53-57`
- `apps/workers/src/queues/reports.ts:21-27`

Problems:

- `contract.send` enqueues `recipients`, while DocuSeal expects `submitters`.
- `report.fetch` enqueues `{ reportId, rangeStart, rangeEnd }`, while the worker expects `{ projectId, reportType, dateRange }`.

Impact:

- These tools are very likely broken at runtime even if the queue job is accepted.
- The approval flow around contracts can succeed up to the point of enqueueing a malformed job.

Recommendation:

- Define job payload schemas in one shared package and use them in both producer and consumer.
- Make tool input schemas transform into shared queue job schemas explicitly.
- Add integration tests that enqueue a job and assert worker-side decoding.

### High 5: MCP server accepts bearer tokens in the URL query string

The MCP SSE endpoint accepts the agent JWT from either the `Authorization` header or `?token=...`.

Evidence:

- `apps/mcp-server/src/server.ts:64-67`

Impact:

- Query-string tokens are more likely to leak into logs, browser history, proxies, analytics, and crash reports.

Recommendation:

- Remove query-string token support.
- Accept only `Authorization: Bearer ...`.

### High 6: Webhook subscriptions create SSRF risk

Any authenticated user can create a webhook with any URL. The worker later `fetch()`es that URL server-side.

Evidence:

- `packages/api/src/router/subscription.ts:19-43`
- `packages/events/src/webhook-delivery.ts:112-123`

Impact:

- This can be used to probe internal services, metadata endpoints, or private network resources.
- Combined with the broken org auth, this is worse: a user from one org can plant subscriptions for another org.

Recommendation:

- Block private IP ranges, loopback, link-local, and internal hostnames.
- Optionally allowlist domains or require verified ownership for webhook targets.
- Store normalized host metadata and log rejects.

### High 7: CORS policy is effectively allow-any-origin with credentials

The gateway reflects arbitrary origins and enables credentials.

Evidence:

- `apps/core/src/server.ts:25-33`

Impact:

- This is a poor default for a cookie-authenticated admin surface.
- Depending on cookie settings and deployment topology, it increases cross-origin abuse risk.

Recommendation:

- Replace origin reflection with an explicit allowlist.
- Separate browser session surfaces from agent surfaces if necessary.

### High 8: Org resolution for users is arbitrary and stale

`resolveOrgId()` picks the first matching membership row and caches it in-process without invalidation.

Evidence:

- `packages/auth/src/org-resolver.ts:18-41`

Impact:

- Multi-org users can resolve to the wrong org unpredictably.
- Membership changes will remain stale until process restart or manual cache clear.

Recommendation:

- Make org selection explicit in the session or request context.
- Validate that explicit org against membership on each request or with bounded cache invalidation.

### Medium 9: Scope vocabulary and docs are inconsistent

The repo uses multiple scope naming conventions.

Evidence:

- `README.md:146`
- `apps/core/src/tools/contract-send.ts:43`
- `apps/core/src/tools/report-fetch.ts:27`
- `apps/core/src/tools/kb-search.ts:32`
- `apps/core/tests/scope.test.ts:34-40`

Examples:

- Docs mention `contract:send`, code uses `contracts:send`
- Docs mention `kb:search`, code uses `kb:read`
- Tests mention `report:fetch`, code uses `reports:read`

Impact:

- This creates confusion in agent provisioning, audits, and operator docs.

Recommendation:

- Standardize scope names once and generate docs/catalog output from code.

### Medium 10: The lint/build pipeline is not healthy

The workspace does not currently present as CI-clean.

Evidence:

- `pnpm -C aires-turbo typecheck` failed
- `pnpm -C aires-turbo lint` failed
- `packages/api` build emitted TS2742 portability errors
- Several packages have no usable ESLint flat config under ESLint 9

Impact:

- Regressions can ship easily because the repo’s own guardrails are not trusted.

Recommendation:

- Pin and enforce Node 22 in CI.
- Fix the `packages/api` declaration/type portability issues.
- Standardize ESLint config across every package or narrow lint scope intentionally.

### Medium 11: Automated test coverage is far too small for the risk profile

I found one test file, and it only exercises the scope helper.

Evidence:

- `apps/core/tests/scope.test.ts`

Impact:

- There is no automated coverage for auth, org authorization, REST/tRPC parity, outbox, webhook retries, tool execution, or MCP bridging.

Recommendation:

- Add tests for:
  - org membership enforcement
  - ID-based authorization
  - SSE org filtering
  - outbox idempotency
  - webhook claim/retry behavior
  - tool job contract compatibility

### Medium 12: The repo still contains template residue and product drift

The main Next.js home page is still a T3 starter page, while the actual CRM views are secondary and query-param driven.

Evidence:

- `apps/nextjs/src/app/page.tsx:1-35`

Impact:

- This makes the repo feel half-product, half-template.
- It also increases the chance that security and UX assumptions are scattered and inconsistent.

Recommendation:

- Remove or quarantine template apps/routes.
- Make the admin app use authenticated org context, not `?org=<uuid>`.

## Suggested Improvement Plan

### Immediate

1. Fix authorization centrally.
2. Fix SSE tenant leakage.
3. Replace non-atomic outbox/webhook selection with real claiming semantics.
4. Repair queue payload contracts for contracts and reports.

### Next

1. Remove query-string token support from MCP.
2. Add SSRF protections for webhook targets.
3. Replace permissive CORS with an explicit allowlist.
4. Normalize scope naming and docs.

### Quality Bar

1. Make `typecheck` green.
2. Make `lint` deterministic under the supported Node version.
3. Add integration tests for authz, events, and worker/job contracts.
4. Remove template residue from the admin surface.

## Bottom Line

The repo is directionally well-designed, but the current implementation is not yet safe for a real multi-tenant CRM where agents act on customer data. The biggest issue is not style; it is trust boundaries. Right now, org isolation, event isolation, and async delivery correctness are not strong enough.

If the goal is to make this production-capable, I would treat the authorization layer and the event plane as the first hardening milestone before adding more tools or UI.
