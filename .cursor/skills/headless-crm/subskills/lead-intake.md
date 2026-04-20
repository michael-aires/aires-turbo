# Lead intake — website form to first follow-up

New lead lands from a marketing site. Create the contact, tag the source,
send a welcome email, and leave a task for the sales rep.

**Prereqs (scopes):** `contact:write`, `email:send`, optionally
`memory:write`. For the task step you currently need a human caller
(tRPC `task.create`) — agent `task.create` is Phase 5.

## Steps

1. **Create the contact.** Call `contact.create` with source tagged so
   reporting can attribute it later.

   ```json
   {
     "email": "ava@example.com",
     "firstName": "Ava",
     "lastName": "Doe",
     "phone": "+16045550001",
     "source": "website-form-ashleigh",
     "status": "new",
     "projectId": "<project-uuid-if-known>",
     "custom": { "utm_source": "google", "utm_campaign": "spring-2026" }
   }
   ```

   Success emits `contact.created` on the outbox. Record the returned
   `id` — you'll need it for follow-ups.

2. **Remember the intake context (optional but recommended).** If you
   have any freeform notes from the form (preferred suite type, timing,
   budget range), drop them into agent memory so later tools can recall.

   ```json
   // memory.remember
   {
     "content": "Ava asked about 2BR units under $900k. Pre-approved mortgage. Wants a weekday morning tour.",
     "namespace": "leads:<contact-id>",
     "projectId": "<project-uuid>",
     "metadata": { "source": "website-form" }
   }
   ```

3. **Send a welcome email.** Queue via `email.send` with `contactId` so
   the worker logs an activity + `communication` row automatically and
   publishes `email.sent`.

   ```json
   {
     "to": "ava@example.com",
     "subject": "Welcome to Ashleigh",
     "html": "<p>Hi Ava, thanks for your interest. A sales rep will reach out within 24 hours.</p>",
     "contactId": "<contact-id>"
   }
   ```

4. **Wait for delivery (optional).** Subscribe to `/events` SSE and match
   on `email.sent` with the returned `messageId` if you want delivery
   confirmation before the next step. Skip if fire-and-forget is fine.

5. **Schedule the human follow-up.** Until Phase 5 ships the `task.create`
   agent tool, the agent should:
   - Emit a synthetic `activity.logged` (via server-side `publish()` in
     an internal workflow), or
   - Surface the intent to a human caller who creates the task via
     tRPC `task.create`.

## Failure modes

- `400` on step 1 — check email format, phone length, `projectId`
  matches an allowed project.
- `429` on step 3 — 60 req/min cap hit. Exponential backoff (2s, 4s, 8s)
  and retry.
- `contact.created` race — if a duplicate form submission fires, the
  second `contact.create` can land too. Before creating, call
  `contact.list` with `query = email` and update instead if a match
  exists.

## Follow-ups

- If the contact replies to the welcome email, the `campaign-reply`
  subskill takes over.
- Add UTM fields to `custom` for attribution reporting (picked up by
  `report.fetch` when the Blackline sync runs).
