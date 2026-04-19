# PXP Server — Capabilities Inventory

> Source: `pxp-server` on branch `feat/upgrades-step-and-transaction-details-page`
> (main-branch parity). Generated 2026-04-18 for the `aires-headless-crm` rebuild.
>
> **Scope note:** This document is the authoritative inventory of what PXP
> does today. It is the **input** to the `aires-headless-crm` phased rebuild
> plan. The headless CRM re-implements these capabilities on Postgres +
> Better-Auth + Railway microservices, with **no runtime connection to
> pxp-server** (one-way bootstrap only).

---

## 1. Repo Shape Summary

| Dimension | Count | Notes |
|---|---|---|
| Top-level Mongoose models | 223 | `models/` — ~170 unique, ~50 with `.ts` duplicates |
| Service files (all levels) | 436 | `services/` + subfolders |
| Top-level services | ~155 | `services/*.js` + V2/V3 namespaces |
| Route modules | 129 | `routes/*.api.js` + `routes/v2/*.route.js` + `routes/v3/*.route.js` |
| V2 typed routes | 39 | `routes/v2/` |
| V3 typed routes | 3 | `routes/v3/` (email campaigns) |
| Vendor integrations | 28 | `vendors/` (Aircall, SendGrid, Nylas, Blackline, DocuSeal/Singular, Pusher, etc.) |
| Binders (composition roots) | 9 | `binders/` — wires models → services → routes |
| Middlewares | 14 | `middlewares/` |
| Permissions modules | ~30 | `permissions/*.permissions.js` |
| Workflow V2 (trigger/action engine) | full engine | `workflowsV2/` — triggers, actions, scheduler, queues, exit |
| Job dispatcher | full framework | `services/jobDispatcher/` — DDD layout (domain/application/infra) |

**Architecture signals:**
- Express 4 + Mongoose 8 + Bull/BullMQ + Redis
- AWS Secrets Manager loaded pre-boot via `bootstrap.js`
- Composition root: `server-main.js` wires binders
- Two process roles: `start:web` (HTTP + cron) and `start:worker` (BullMQ consumers)
- V2/V3 APIs use TypeScript transpile-in-place (`.ts` → `.js` committed side-by-side)
- Swagger/OpenAPI docs generated from JSDoc comments

---

## 2. Capability Domains

Each domain below lists:
- **What it does** (functional description)
- **Primary routes / services / models**
- **External integrations** it depends on
- **Target location** in `aires-headless-crm` (what package or app will own it)

Target legend:
- `core` = `apps/core` (Hono REST + tRPC synchronous API)
- `workers` = `apps/workers` (BullMQ queue consumers)
- `mcp` = `apps/mcp-server` (AI agent tool surface)
- `@db` = `packages/db` (Drizzle schema)
- `@integrations` = `packages/integrations` (vendor adapters)
- `@events` = `packages/events` (outbox + webhooks)
- `@rag` = `packages/rag` (embeddings + memory)
- `@agents` = `packages/agents` (agent runtime + tools)

---

### 2.1 Identity, Auth & Tenancy

| Capability | PXP entrypoint | Target |
|---|---|---|
| User CRUD, invitations, roles | `routes/users.api.js`, `services/users.service.js`, `services/v2/users/`, `binders/usersV2.binder.js` | `core` + `@db.identity` |
| Permission roles (RBAC) | `routes/permissionRole.api.js`, `services/permissionRole.service.js`, `permissions/` | `core` + `@db.identity` |
| Identity (auth token) routes | `routes/identity.api.js` | Better-Auth in `@auth` |
| Project/tenant scoping | `models/project.js`, `services/projects.service.js`, `middlewares/checkProjectAccess.js`, `middlewares/requireProjectAccess.js` | `core` middleware |
| User lifecycle automation | `services/v2/userLifecycle/`, `services/user/UserLifecycleNotify.js`, `services/user/UserAutomationService.js` | `workers` job |
| Bulk user operations | `routes/bulkUsersOperations.api.js`, `models/bulkUsersOperations.js` | `workers` |
| Sales rep groups | `services/salesRepGroup.service.js`, `routes/salesRepGroup.api.js` | `core` + `@db.crm` |
| API users / API keys | `models/apiUser.js`, Better-Auth `apiKey` plugin | Better-Auth in `@auth` |
| User project assignments | `repositories/implementations/mongo/MongoUserProjectAssignmentRepository.js` | `@db.identity.member` |

**Key PXP models:** `user`, `permissionRole`, `project`, `salesRep`, `salesRepGroup`, `userSalesRepRelation`, `userInvitation`, `apiUser`, `bulkUsersOperations`, `userUpdateTracking`.

**Already partially done in aires-turbo:**
- `packages/db/src/schema/identity.ts` — organization, member, project, apiKey, jwks, agent, agentToken, auditLog
- `packages/auth` — Better-Auth with admin + organization + apiKey + jwt plugins
- `apps/core/src/agent-tokens.ts` — agent JWT signing

---

### 2.2 Contacts, Buyers, Leads & Corporations

| Capability | PXP entrypoint | Target |
|---|---|---|
| Contact CRUD + filtering | `routes/contacts.api.js`, `services/contacts/`, `services/v2/contacts/` | `core` + `@db.crm.contact` |
| Buyer / realtor / broker records | `models/buyer.js`, `models/broker.js`, `models/referralAgent.js`, `models/managingBroker.js`, `services/v2/contacts/realtors.route.js` | `core` + `@db.crm` |
| Corporations / developer companies | `routes/corporations.api.js`, `services/corporations.service.js`, `services/developerCompany.service.js` | `core` + `@db.crm` |
| Lead management (v1 + v2) | `routes/leads.api.js`, `routes/leads2.api.js`, `services/leads.service.js`, `services/leads2.service.js`, `services/v2/leads/`, `services/v2/leadRegistration/` | `core` |
| Lead assignment rules + round-robin | `routes/leadAssignmentRule.api.js`, `services/leadAssignmentRule.service.js`, `models/leadAssignment.js`, `models/leadAssignmentRule.js` | `core` + `workers` (assignment job) |
| Lead rating (scoring + history) | `services/v2/leadRating/`, `services/v2/leadRatingHistory*`, `models/leadRatingHistory.js`, `models/leadRatingSettings.js`, `services/leadRatingReadModel.js`, `services/leadRatingSettings.service.js` | `core` + `workers` (recalc job) |
| Lead score Redis cache | `services/v2/LeadScoreRedisCache.js`, `services/v2/leadScoreCacheRedisClient.js` | `@integrations/redis-cache` |
| Lead status settings | `routes/leadstatusSettings.api.js`, `services/leadstatusSettings.service.js` | `core` |
| Contact status tracking | `services/leadActivity/ContactStatusTracker.js` | `core` |
| Sign-ups / waitlists | `models/signUp.js`, `routes/waitlists.api.js`, `services/waitlists.service.js`, `models/waitlist.js` | `core` |
| Custom collections + forms | `routes/customCollection.api.js`, `routes/customForm.api.js`, `services/customForm/`, `models/customForm.js`, `models/customFormSubmissions.js` | `core` |
| Lists (v2 + v3) | `routes/list.api.js`, `routes/listv3.api.js`, `services/list.service.js`, `services/listv3.service.js`, `services/v2/lists.*`, `services/listFilterProcessor.service.js`, `services/listChangeStream.service.js` | `core` + `workers` (change-stream) |
| Filter registry | `services/filters/` (BaseFilter, ContactStatusFilter, LeadScoreFilter, LeadSourceFilter, ListMembershipFilter, RegistrationDateFilter, SalesRepAssignmentFilter, ActivityStatusFilter, EmailCampaignRecipientsFilter) | `@db` query helpers |

**Key PXP models:** `buyer`, `broker`, `referralAgent`, `managingBroker`, `corporation`, `corporateDemandNote`, `developerCompany`, `leadAssignment`, `leadAssignmentRule`, `leadBroker`, `leadRatingHistory`, `leadRatingSettings`, `leadStatusSettings`, `list`, `listHistory`, `signUp`, `waitlist`, `customCollection`, `customForm`, `customFormSubmissions`.

---

### 2.3 Communications — Email

| Capability | PXP entrypoint | Target |
|---|---|---|
| Email campaigns V2 (dispatch, analytics, reporting) | `services/v2/emailCampaigns/`, `services/v2/emailCampaignsV2.*`, `routes/v2/emailCampaignsV2*.route.js`, `models/campaignV2Model.js`, `models/campaignV3.model.js`, 8 models for analytics | `core` + `workers` (dispatch/analytics) |
| Email campaigns V3 (newer pipeline) | `services/v3/emailCampaigns/`, `routes/v3/campaigns.route.js`, `models/campaignV3.model.js`, `models/campaignBatch.model.js`, `models/campaignExecution.model.js` | `core` + `workers` |
| Email templates | `services/emailTemplates/`, `services/emailTemplates.service.js`, `routes/emailTemplates.api.js`, `models/email-templates.js`, `models/email-template-folders.js`, `models/email-template-tags.js` | `core` |
| Email images | `routes/emailImages.api.js`, `services/emailImages.service.js`, `models/emailImage.js` | `core` (S3 delegate) |
| Email receipts | `routes/emailReceipts.api.js`, `services/emailReceipts.service.js`, `models/emailReceipt.js` | `workers` inbox |
| Email report settings | `routes/emailReportSettings.api.js`, `services/emailReportSettings.service.js` | `core` |
| SendGrid integration | `services/sendGrid.service.js`, `services/sendGridJobs.service.js`, `services/sendGridList.service.js`, `services/v2/sendGridJobs/`, `services/v2/sendGridMailSend.provider.js`, `vendors/sendGridConfig/`, `models/sendGridJobs.js`, `models/sendGridTemplate.js`, `services/webhooks/sendgrid/` | `@integrations/sendgrid` + `workers` |
| Email inbox (unified) | `services/v2/emailInbox/`, `services/v2/emailInbox.*`, `routes/v2/emailInbox.route.js`, `routes/v2/emailMailbox.route.js`, `models/emailMailboxThread.js` | `core` + `workers` |
| Nylas sync (Gmail/O365) | `services/nylas.service.js`, `services/nylasWebhookIngestion.service.js`, `services/v2/nylasBackfill/`, `services/v2/nylasWebhookIngestion.service.js`, `services/v2/nylasGrantResolver.js`, `routes/nylas.api.js`, `routes/nylasV2.api.js`, `routes/v2/nylasWebhook.route.js`, `routes/v2/nylasBackfill.route.js`, `vendors/nylas/`, `models/nylasWebhookInbox.js` | `@integrations/nylas` + `workers` |
| Email provider adapter | `services/emailProvider/`, `services/v2/emailProvider/`, `services/v2/emailMailbox/`, `services/v2/emailSync/` | `@integrations/email-provider` |
| Template preview | `services/v2/emailTemplatePreview/`, `routes/v2/emailTemplatePreview.route.js` | `core` |
| Suppressions / unsubscribe | `routes/suppressions.api.js`, `services/suppressions.service.js`, `models/unsubscribePolicy.model.js`, `routes/v3/unsubscribePolicies.route.js` | `core` + `workers` |
| Merge fields (email) | `helpers/emailMergeFieldsHelper.js`, `repositories/emailMergeFieldsHelper.repositories.js`, `services/v2/emailCampaignsV2MergeFields.service.js` | `@integrations/merge-fields` |
| Email data / history | `models/emailData.js`, `models/emailHistory.js`, `models/email-activity.js`, `models/email-campaigns.js`, `models/email-events.js`, `models/workflowEmailReply.js` | `@db.crm.communication` |

**Key models (23+):** all `EmailCampaignsV2*` models, `campaignV2Model`, `campaignV3`, `campaignBatch`, `campaignExecution`, `campaignSession`, `campaignContact`, `campaignFilter`, `campaignActivity`, `sendGridJobs`, `sendGridTemplate`, `email-templates`, `emailReceipt`, `emailData`, `emailHistory`, `emailImage`, `nylasWebhookInbox`, `emailMailboxThread`, `unsubscribePolicy`, `suppression policy`.

---

### 2.4 Communications — Voice & SMS (Aircall)

| Capability | PXP entrypoint | Target |
|---|---|---|
| Aircall core service | `services/aircall.service.js`, `services/aircall-contact.service.js`, `routes/aircall.api.js`, `vendors/aircall/` | `@integrations/aircall` |
| Aircall phone (call routing, voicemail, audit) | `services/aircall-phone/` (call-audit, call-fetcher, call-filter, call-initiator, contact-matcher, notes-sync, voicemail), `services/aircall-phone.service.js`, `services/aircall-phone-sync.service.js`, `routes/aircall-phone.api.js` | `workers` (sync) + `core` (API) |
| Aircall SMS (send, sync, rate limit, broadcast) | `services/aircall-sms.service.js`, `services/aircall-sms-sync.service.js`, `services/aircall-sms-rate-limiter.js`, `services/aircall-sms-broadcast.service.js`, `services/aircall-sms-analytics.service.js`, `services/per-user-sms-rate-limiter.js`, `routes/aircall-sms.api.js`, `routes/aircall-sms-broadcast.api.js` | `@integrations/aircall` + `workers` |
| Aircall number → project mapping | `services/aircall-number-project-mapping.service.js`, `models/aircallNumberProjectMapping.js` | `@db.crm` |
| Call settings / calls / calls dashboard | `routes/callSettings.api.js`, `routes/calls.api.js`, `services/calls.service.js`, `services/callsDashboard.service.js`, `services/callSettings.service.js`, `models/call.js`, `models/callAudit.js`, `models/callSettings.js`, `models/microsoftTeamCalls.js` | `core` |
| SMS (legacy) | `routes/sms.api.js`, `services/sms.service.js`, `vendors/sms/`, `models/smsCampaign.js` | `@integrations/sms` |
| SMS conversations & messages | `models/aircallSmsConversation.js`, `models/aircallSmsMessage.js`, `models/aircallSmsCampaign.js` | `@db.crm` |

**Already partially done:** `packages/integrations/src/aircall/` stub.

---

### 2.5 Sales Transactions & Contracts

This is the **largest** domain in PXP — most complex, most business-critical.

| Capability | PXP entrypoint | Target |
|---|---|---|
| Sales Transaction CRUD (V2/V3) | `routes/salesTransaction.api.js`, `routes/v2/salesTransactions.route.js`, `services/salesTransaction/`, `services/salesTransaction.service.js`, `services/v2/salesTransaction/`, `models/salesTransaction.js`, `models/salesTransactionV4.js`, `models/salesTransactionVersion.js` | `core` + `@db.crm` |
| Transaction pricing | `routes/v2/pricingConfig.route.js`, `routes/v2/transactionPricing.route.js`, `models/pricingConfig.js`, `models/transactionPricing.js`, `services/v2/signature/`, service helpers under `salesTransaction/` | `core` |
| Deposits | `routes/deposits.api.js`, `routes/depositOption.api.js`, `services/deposits.service.js`, `services/depositOption.service.js`, `models/deposit.js`, `models/depositOption.js`, `models/paymentRound.js` | `core` + `workers` |
| Offers + offer versions + offer edits | `routes/offer.api.js`, `routes/offerVersions.api.js`, `routes/offerEdits.api.js`, `services/offer.service.js`, `services/offerVersions.service.js`, `services/offerEdits.service.js`, `models/offer.js`, `models/offerVersion.js`, `models/offerEdit.js` | `core` |
| Commissions | `routes/commissions.api.js`, `services/commission.service.js`, `models/commission.js` | `core` |
| Reservations | `routes/reservation.api.js`, `services/reservation.service.js`, `models/reservation.js`, `models/unitReservation.js` | `core` |
| Sales transaction forms (builder + versions) | `routes/salesTransactionForm.api.js`, `services/salesTransactionForm.service.js`, `models/salesTransactionForm.js`, `models/salesTransactionFormVersion.js`, `routes/v2/formVersions.route.js`, `routes/v2/formValidation.route.js`, `routes/v2/masterForms.route.js`, `routes/v2/sectionLayout.route.js`, `services/customSectionTemplate.service.js`, `models/customSectionTemplate.js` | `core` |
| Contract template | `routes/contractTemplate.api.js`, `services/contractTemplate.service.js`, `services/v2/contractTemplate/`, `models/contractTemplate.js`, `models/contractField.js`, `models/contractDetail.js`, `models/transactionTemplate.js` | `core` |
| Contracts (signing, generation) | `routes/contracts.api.js`, `routes/v2/contracts.route.js`, `services/contracts.service.js`, `services/v2/contracts/`, `services/v2/contractSigningApi.service.js`, `services/v2/contractSigningRoleSlots.js`, `services/contractsDocusealHookHelpers.js`, `models/contract.js` | `core` + `workers` + `@integrations/docuseal` |
| Singular contract (alt signing) | `routes/singularContracts.api.js`, `services/singularContracts.service.js`, `services/v2/singularContract/`, `models/singularContract.js` | `@integrations/singular-contract` |
| DocuSeal configuration | `routes/docusealConfigs.api.js`, `services/docusealConfigs.service.js`, `models/docusealConfigs.js`, `helpers/getDocusealConfig.js`, `helpers/docusealRoles.js` | `core` + `@integrations/docuseal` |
| Contract merge fields | `routes/v2/contractMergeFields.route.js`, `services/v2/contractMergeFields/`, `services/mergeFields/`, `domain/mergeFields/` | `core` + `@integrations/merge-fields` |
| Transaction import | `routes/transactionImport.api.js`, `services/transactionImportService.js` | `workers` (import job) |
| Transaction attachments | `routes/v2/transactionAttachments.route.js`, `services/v2/assets/` | `core` + S3 |
| Contact transactions view | `routes/v2/contactTransactions.route.js` | `core` |
| Upgrade options + categories + reporting | `routes/v2/upgradeOptions.route.js`, `routes/v2/upgradeCategories.route.js`, `routes/v2/upgradeAvailability.route.js`, `routes/v2/upgradeReporting.route.js`, `services/v2/upgradeOptions/`, `models/upgradeOption.js`, `models/upgradeCategory.js` | `core` |
| Parking / storage allocations | `routes/parking.api.js`, `services/parking.service.js`, `models/parking*.js`, `models/storage*.js` | `core` |
| Buyer incentives | `routes/buyerIncentive.api.js`, `services/buyerIncentive.service.js`, `models/buyerIncentive.js` | `core` |
| Buyer portal configs | `routes/buyerPortalConfigs.api.js`, `services/buyerPortalConfigs.service.js`, `models/buyerPortalConfigs.js` | `core` |
| Demand notes (v1 + v2 + corporate) | `routes/demandNote.api.js`, `routes/demandNoteV2.api.js`, `services/demandNote.service.js`, `services/demandNoteV2.service.js`, `services/demandNote/defaultDemandNoteProcessor.js`, `models/demandNote.js`, `models/demandNoteV2.js`, `models/corporateDemandNote.js`, `models/inventoryDemandLogs.js`, `services/v2/emailCampaignsV2DemandNote.repository.js` | `core` + `workers` |
| Contract signing role slots + adapters | `services/v2/adapters/`, `services/v2/contractSigningApi.types.*`, `services/v2/contractSigningRoleSlots.*` | `core` |

**Models (30+):** `salesTransaction`, `salesTransactionV4`, `salesTransactionVersion`, `salesTransactionForm`, `salesTransactionFormVersion`, `contract`, `contractTemplate`, `contractField`, `contractDetail`, `transactionTemplate`, `transactionPricing`, `pricingConfig`, `singularContract`, `docusealConfigs`, `deposit`, `depositOption`, `paymentRound`, `payment`, `offer`, `offerEdit`, `offerVersion`, `commission`, `reservation`, `unitReservation`, `upgradeOption`, `upgradeCategory`, `option`, `customForm`, `customFormSubmissions`, `customSectionTemplate`, `buyerIncentive`, `buyerPortalConfigs`, `demandNote`, `demandNoteV2`, `corporateDemandNote`, `inventoryDemandLogs`.

**Dependencies:** DocuSeal, Singular, S3 (attachments), SendGrid (notifications), Blackline (sync).

**Already partially done:** `apps/core/src/tools/contract-send.ts` stub (MCP tool); `packages/integrations/src/docuseal`.

---

### 2.6 Inventory — Units, Floorplans, Pricing

| Capability | PXP entrypoint | Target |
|---|---|---|
| Units | `routes/units.api.js`, `services/units.service.js`, `services/unit/UnitQueryService.js`, `models/unit.js` | `core` + `@db.crm` |
| Unit groups | `routes/unitGroup.api.js`, `services/unitGroup.service.js`, `models/unitGroup.js` | `core` |
| Inventory settings | `routes/inventorySettings.api.js`, `routes/inventoryStatusSettings.api.js`, `services/inventorySettings.service.js`, `services/inventory/statusResolution.shared.js`, `models/inventorySettings.js`, `models/inventoryStatusSettings.js` | `core` |
| Inventory notes | `routes/inventoryNotes.api.js`, `services/inventoryNotes.service.js`, `models/inventoryNotes.js` | `core` |
| Inventory import | `services/inventoryImportService.js`, `vendors/inventory/` | `workers` |
| Buildings | `routes/buildings.api.js`, `services/buildings.service.js`, `models/building.js` | `core` |
| Floorplans | `routes/floorPlan.api.js`, `services/floorPlan.service.js`, `models/floorPlan.js` | `core` |
| Home designs + specifications | `routes/homeDesigns.api.js`, `routes/homeDesignSpecifications.api.js`, `services/homeDesigns.service.js`, `services/homeDesignSpecifications.service.js`, `models/homeDesign.js`, `models/homeDesignSpecification.js` | `core` |
| Map inventory + polygons | `routes/mapInventory.api.js`, `services/mapInventory.service.js`, `models/map-inventory.js`, `models/*Polygon.js` (inventory, parking, storage, unit) | `core` |
| Parking / storage inventory + allocation | `models/parkingInventory.js`, `models/parkingAllocation.js`, `models/storage.js`, `models/storageInventory.js`, `models/storageAllocation.js` | `core` |
| Property (project-level inventory) | `services/v2/property/`, `models/property.js` | `core` |
| Project dashboard inventory | `services/v2/projectDashboardInventory.service.js`, `routes/v2/projectDashboardInventory.route.js` | `core` |

**Key models:** `unit`, `unitGroup`, `unitReservation`, `building`, `floorPlan`, `homeDesign`, `homeDesignSpecification`, `map-inventory`, `inventory`, `inventorySettings`, `inventoryStatusSettings`, `inventoryNotes`, `inventoryPolygon`, `parking`, `parkingInventory`, `parkingAllocation`, `parkingPolygon`, `storage`, `storageInventory`, `storageAllocation`, `storagePolygon`, `unitPolygon`, `property`, `project`.

---

### 2.7 Activities, Notes, Tasks, Meetings

| Capability | PXP entrypoint | Target |
|---|---|---|
| Activity notes | `routes/activityNotes.api.js`, `services/activityNotes.service.js`, `services/aggregated-notes.service.js`, `models/activityNote.js` | `core` + `@db.crm.activity` |
| General notes | `services/notes.service.js`, `models/note.js` | `core` |
| Daily summary notes | `routes/dailySummaryNote.api.js`, `services/dailySummaryNote.service.js`, `models/dailySummaryNote.js` | `core` |
| Interaction notes (data + panel) | `services/interactionNotesData.service.js`, `services/interactionNotesPanel.service.js` | `core` |
| Lead activity (aggregator, status tracker, response time, rep activity) | `services/leadActivity/ActivityAggregator.js`, `services/leadActivity/ContactStatusTracker.js`, `services/leadActivity/ResponseTimeCalculator.js`, `services/leadActivity/SalesRepActivityTracker.js` | `core` + `workers` |
| User activity (tracking + reporting) | `routes/userActivity.api.js`, `routes/v2/userActivity.route.js`, `services/userActivity.service.js`, `services/v2/userActivity.service.js`, `services/user/UserUpdateTrackingService.js`, `models/userActivity.js`, `models/userUpdateTracking.js` | `core` + `workers` |
| Tasks | `routes/tasks.api.js`, `services/tasks.service.js`, `models/task.js` | `core` + `@db.crm.task` |
| Tasks calendar | `services/v2/tasksCalendar.service.js`, `services/v2/tasksCalendar.repository.js`, `routes/v2/tasksCalendar.route.js` | `core` |
| Meetings | `routes/meetings.api.js`, `services/meetings.service.js`, `models/meeting.js`, `models/attendee.js`, `services/v2/calendar/` | `core` |
| Events (calendar events) | `routes/events.api.js`, `services/events.service.js`, `models/event.js` | `core` |
| Follow-up campaigns | `routes/followUpCampaigns.api.js`, `services/followUpCampaigns.service.js`, `models/followUpCampaign.js` | `workers` |
| Presentation center | `routes/presentation.api.js`, `routes/presentationCenterBooking.api.js`, `services/presentation.service.js`, `services/presentationCenterBooking.service.js`, `services/presentationCenterNotification.service.js`, `services/presentationCenterReportData.service.js`, `services/v2/presentationCenter/`, `models/presentationCenterAppointment.js`, `models/presentationCenterVisit.js`, `models/bookingConfiguration.js`, `jobs/presentationCenterReminders.js` | `core` + `workers` (reminders cron) |
| Pipeline metrics | `routes/pipelineMetrics.api.js`, `services/pipelineMetrics.service.js`, `models/pipeline.js` | `core` |
| Deals | `routes/deal.api.js`, `services/deal.service.js`, `models/deal.js` | `core` |
| Opportunities | `routes/opportunity.api.js`, `services/opportunity.service.js`, `models/opportunity.js` | `core` |
| Sales rep home feed | `routes/salesRepHomeFeed.api.js`, `services/salesRepHomeFeed.service.js`, `services/salesRepHomeFeed.helpers.js`, `services/salesRepHomeFeed.utils.js` | `core` |
| Conversations (activity timeline) | `routes/conversations.api.js`, `services/conversations.service.js` | `core` |

---

### 2.8 Workflow Engine (WorkflowsV2)

The **most sophisticated** system in PXP. Full trigger/action/exit state machine.

| Capability | PXP entrypoint | Target |
|---|---|---|
| Workflow engine | `workflowsV2/index.js`, `workflowsV2/execute/`, `workflowsV2/exit/`, `workflowsV2/scheduler/`, `workflowsV2/queues/`, `workflowsV2/groups.js`, `workflowsV2/test/`, `workflowsV2/utils/` | `@workflows` new package |
| Triggers | `workflowsV2/triggers/` — events, forms, lists, pc-visit, users, `_ids.js` | `@workflows/triggers` |
| Actions | `workflowsV2/actions/` — delays, demand-notes, email, lists, sms, tasks | `@workflows/actions` |
| Workflow models | `models/workflows.js`, `models/workflowTemplates.js`, `models/workflowVersion.js`, `models/workflowExitCondition.js`, `models/workflowsInstance.js`, `models/workflowsActions.js`, `models/workflowsActionsLogs.js`, `models/scheduledWorkflowAction.js`, `models/systemWorkflow.js`, `models/workflowEmailReply.js` | `@db.workflows` |
| Workflow routes | `routes/workflows.api.js`, `routes/v2/workflows.route.js`, `routes/v2/workflows.openapi.js`, `routes/system-workflows.api.js` | `core` |
| Workflow services | `services/v2/workflows/`, `services/v2/workflows.service.js`, `services/v2/workflowsBuilder.service.js`, `services/v2/workflowsComposition.js`, `services/systemWorkflow.service.js`, `services/workflowExecution.service.js`, plus 7 V2 workflow repos | `core` + `workers` |

**Key insight:** this is a state machine. Triggers queue events → scheduler distributes → actions execute via BullMQ → exit conditions terminate. In the rebuild, use **Postgres-backed job state** + BullMQ, mirroring the abstraction but on the new stack.

---

### 2.9 Job Dispatcher & Queue Infrastructure

| Capability | PXP entrypoint | Target |
|---|---|---|
| Job dispatcher framework (DDD) | `services/jobDispatcher/` (domain/application/infra/container/events/processor), `services/jobDispatcher/NewDispatcherService.js`, `DispatcherMetrics.js` | `@agents/dispatcher` or `workers` core |
| Queue manager | `services/queue/QueueManager.js`, `services/queue/JobHandlerRegistry.js`, `services/queue/JobIdGenerator.js`, `services/queue/JobRouter.js`, `services/queue/QueueWriteService.js` | `workers` |
| Queue write/read facade | `services/queueWrite.service.js`, `services/queueRead.service.js` | `workers` |
| BullMQ vendor adapter | `vendors/bullMq/`, `helpers/bullmqCleanupModules.js` | `workers` |
| Redis connection | `services/redisConnection.service.js`, `services/redisConfig.service.js` | `workers` |
| Admin dispatcher metrics | `routes/admin/dispatcher-metrics.api.js` | `core` admin route |
| Queues public API | `routes/queues.api.js` | `core` |

**Already partially done:** `apps/workers/src/queues/` (contracts, email, reports, sms) + `outbox-dispatcher.ts` + `webhook-deliverer.ts`.

---

### 2.10 Reports & Analytics

| Capability | PXP entrypoint | Target |
|---|---|---|
| Report generation (general) | `controllers/report.controller.js`, `services/reports/` (ReportGenerator, ReportRegistry, ReportSchema, ReportTypeService, DailyReportStatsService, DateFilterService, SalesRepStatsService, SensitiveDataHandler, TerminologyService), `services/reportGeneration.service.js`, `services/reportData.service.js`, `services/reportExcel.service.js`, `services/reportPreview.service.js`, `services/reportStorage.service.js`, `services/reportTemplate.service.js` | `core` + `workers` (generate job) |
| Report templates | `routes/reportTemplate.api.js`, `models/reportTemplate.js`, `models/ReportJob.js`, `models/dailyReport.js` | `core` |
| Daily / EOD / V4 reports | `services/emailTemplates/dailyReportTemplate.service.js`, `services/emailTemplates/dailyReportTemplateV4.service.js`, `services/eodReportData.service.js`, `templates/daily-report-v4.hbs` | `workers` |
| Project dashboard | `services/projectDashboard.service.js`, `services/v2/dashboard/`, `services/v2/dashboardLists/`, `services/v2/dashboardUserCohort/`, `services/v2/corporateDashboard/`, routes for dashboardRead/Debug/Lists/corporateDashboard | `core` |
| Sales budget | `routes/salesBudget.api.js`, `services/salesBudget.service.js`, `services/salesBudget.factory.js`, `services/salesBudgetDashboard.service.js`, `services/salesBudgetPdf.service.js`, `models/salesBudget.js`, `services/emailTemplates/salesBudgetReportTemplate.service.js` | `core` + `workers` |
| Sales analytics | `routes/sales.api.js`, `services/sales.service.js`, `routes/analytics.api.js`, `routes/analytics/leads.api.js`, `routes/analytics/reservation.api.js`, `services/analytics.service.js` | `core` |
| Goals tracking | `routes/goals.api.js`, `services/goals.service.js`, `models/goal.js`, `models/goalCount.js` | `core` |
| Traffic reporting | `routes/traffic.api.js`, `services/traffic.service.js` | `core` |
| Website report configs | `routes/websiteReportConfigs.api.js`, `services/websiteReportConfigs.service.js`, `models/websiteReportConfigs.js` | `core` |
| Project report settings | `routes/projectReportSettings.api.js`, `services/projectReportSettings.service.js`, `models/projectReportSettings.js` | `core` |
| Email campaigns reporting (PDF, tracking) | `services/v2/emailCampaignsV2Reporting/`, `services/v2/emailCampaignsV2ReportPdf.service.js`, `services/v2/reporting/` | `workers` |
| Lead score reporting | `services/v2/leadRatingHistoryAverage.service.js`, `services/v2/leadRatingHistoryComposition.js`, `services/v2/leadRatingHistoryResultBuilder.js` | `core` |
| User activity reporting | `services/userActivity.service.js`, V2 equivalents | `core` |
| Closed-loop / dashboard read | `services/v2/dashboardRead.route.js` (dashboard reads) + frontend-driven | `core` |

**Key models:** `dailyReport`, `reportTemplate`, `ReportJob`, `salesBudget`, `goal`, `goalCount`, `pipeline`, all EmailCampaignsV2 analytics models.

---

### 2.11 External Integrations

| Integration | PXP location | Target |
|---|---|---|
| SendGrid | `vendors/sendGridConfig/`, `services/sendGrid.service.js`, webhook handler at `routes/emailCampaignsV2WebhookPublic.api.js` | `@integrations/sendgrid` + `workers` |
| Aircall | `vendors/aircall/`, `services/aircall*`, webhook routes | `@integrations/aircall` |
| Nylas | `vendors/nylas/`, `services/nylas*`, V2 backfill | `@integrations/nylas` |
| DocuSeal | `services/docusealConfigs.service.js`, `helpers/getDocusealConfig.js`, `services/contractsDocusealHookHelpers.js` | `@integrations/docuseal` |
| Singular (alt sig) | `vendors/signature/`, `services/singularContracts.service.js` | `@integrations/singular` |
| Blackline | `vendors/blackline/`, `services/blackline.service.js`, `services/blacklineReportData.service.js`, `routes/blackline.api.js`, `models/blacklineForm.js`, `models/blacklineTransaction.js`, `models/blacklineUnit.js`, `models/blacklineSyncLog.js` | `@integrations/blackline` + `workers` (sync) |
| Lasso / MailChimp / RingCentral / Microsoft Teams | `vendors/lasso/`, `vendors/mailChimp/`, `vendors/ringcentral/`, `vendors/microsoft/` | `@integrations/` (per-vendor, lazy) |
| HubSpot webhook | `models/hubspotWebhook.js` | `@integrations/hubspot` |
| Rudderstack / analytics | `vendors/analytics/`, `models/rudderstack.js` | `@integrations/analytics` |
| Image finder / OCR / bulk import | `vendors/imageFinder/`, `vendors/ocr/`, `vendors/bulkImport/` | `@integrations/` |
| SMS generic | `vendors/sms/`, `services/sms.service.js` | `@integrations/sms` |
| Pusher (realtime) | `vendors/pusherKey/`, `vendors/realtime/`, `vendors/pubSub/` | `@integrations/realtime` or replace with SSE |
| Payments | `vendors/payment/`, `services/payments.service.js`, `routes/payments.api.js`, `models/payment.js` | `@integrations/payments` |
| Webhooks inbound (generic) | `routes/webhookMonitoring.api.js`, `routes/webhooks/`, `services/webhooks/`, `services/webhooks.service.js`, `routes/webhooks.api.js`, `models/failedWebhook.js` | `core` (ingress) + `workers` (dispatch) |
| Push notifications | `routes/pushNotifications.api.js`, `services/pushNotifications.service.js` | `@integrations/push` |
| File storage | `routes/files.api.js`, `services/files.service.js`, `models/files.js`, `routes/storage.api.js`, `services/storage.service.js`, `models/storage.js`, `routes/privateDocument.api.js`, `services/privateDocument/`, `services/privateDocument.service.js`, `models/privateDocument.js` | `@integrations/s3` |
| QLDB ledger audit (AWS) | `services/qldb.js`, `services/qldb.service.js`, `services/qldb/`, `qldb-models/`, `routes/qldb.api.js`, `binders/qldb-models.binder.js` | **deprecate** — use `@db.identity.auditLog` |

---

### 2.12 Messaging / Realtime / Webhooks

| Capability | PXP entrypoint | Target |
|---|---|---|
| Socket.IO server | `socketio/` | replace with SSE (`apps/core/src/sse.ts`) |
| Push notifications | `services/pushNotifications.service.js` | `@integrations/push` |
| Webhook monitoring | `routes/webhookMonitoring.api.js` | `core` admin |
| Outbox pattern | (not explicit — implicit via workflows) | `@events/outbox` (already scaffolded) |
| Event bus | events.service.js | `@events` |

---

### 2.13 Cross-Cutting Infrastructure

| Capability | PXP entrypoint | Target |
|---|---|---|
| Mongoose adapter + base repos | `infrastructure/adapters/MongooseAdapter.js`, `repositories/base/`, `repositories/implementations/mongo/` | replace with Drizzle in `@db` |
| Database init + connection manager | `infrastructure/databaseInit.js`, `infrastructure/connectionManager.js`, `config/database.config.js` | `@db.client` (done) |
| Startup migrations | `infrastructure/startupMigrations.js`, `config/startupMigrations.config.js` | `drizzle-kit` migrations |
| Background init | `infrastructure/backgroundInit.js` | `workers` boot |
| Graceful shutdown | `infrastructure/gracefulShutdown.js` | `workers` + `core` |
| Process error handlers | `infrastructure/processErrorHandlers.js` | `workers` + `core` |
| Express stack builder | `infrastructure/expressStack.js` | replaced by Hono in `apps/core` |
| Server init + listener | `infrastructure/serverInit.js`, `infrastructure/serverListener.js` | `apps/core/src/server.ts` |
| Worker startup | `infrastructure/workerStartup.js` | `apps/workers/src/main.ts` |
| Prometheus metrics | `services/metrics/`, `middlewares/prometheusMetrics.middleware.js`, `routes/metrics.route.js`, `middlewares/performanceMetrics.js` | `@observability` (OTel + Prometheus exporter) |
| Request trace middleware | `middlewares/requestTrace.middleware.js` | `@observability` |
| Token middleware | `middlewares/token.js` | Better-Auth middleware |
| Pagination / validation | `middlewares/pagination.js`, `middlewares/validateQuery.js` | Hono middleware in `@auth` or `core` |
| Logger (Winston) | `logger.js`, `logger/` | Pino via `@observability` (done) |
| AWS Secrets Manager loader | `utils/loadAwsSecrets.js` | Railway env injection (no AWS needed) |
| Feature flags | `services/featureFlagService.js`, `models/FeatureFlag.js` | `@db` + service layer |
| Operation audit | `models/operation-audit.js` | `@db.identity.auditLog` |
| Cron scheduler | `vendors/cron/`, `cronjobs/syncDocuSign.js` | `apps/workers` BullMQ repeat jobs |
| Swagger docs | `swaggerJsDoc` in `server-main.js` | OpenAPI generation from Hono routes |

---

### 2.14 AI & Agents (partial in PXP)

| Capability | PXP entrypoint | Target |
|---|---|---|
| AI conversations | `routes/aiConversations.api.js`, `services/aiConversations.service.js`, `models/aiConversations.js` | `@agents` (new home) |
| AI summary | `services/aiSummary.service.js` | `@agents` |
| Survey questions | `routes/surveyQuestions.api.js`, `services/surveyQuestions.service.js`, `models/surveyQuestions.js` | `core` |

**New in aires-headless-crm (no PXP equivalent):**
- `packages/agents` — agent runtime, approvals, audit, rate-limit, tools
- `packages/rag` — embeddings, memory, search, ingest, chunk
- `apps/mcp-server` — MCP server exposing tools
- `apps/core/src/agent-tokens.ts` — scoped agent JWTs

---

### 2.15 Demo / Admin / Misc

| Capability | PXP entrypoint | Target |
|---|---|---|
| Demo apps | `routes/demoApps.api.js`, `services/demoApps.service.js`, `models/demoApp.js` | `core` (optional) |
| Developer admin dashboard | `routes/developerAdminDashboard.api.js`, `services/developerAdminDashboard.service.js`, `models/developerAdmin.js` | `core` |
| Landing page | `routes/landingPage.api.js`, `services/landingPage.service.js`, `models/landingPage.js` | `core` (optional) |
| Ads channels | `routes/ads-channel.api.js`, `models/adsChannels.js` | `core` (optional) |
| Lookup lists | `routes/lookuplists.api.js`, `services/lookuplists.service.js`, `models/lookupList.js` | `core` |
| Dropdown options | `routes/dropdownOptions.api.js`, `models/dropdownOption.js` | `core` |
| Reminder settings | `models/reminderSettings.js` | `core` |
| Shared inbox settings | `models/sharedInboxSettings.js` | `core` |
| Excel service | `services/excel.service.js`, `helpers/excel.js` | `@integrations/excel` |
| User table views | `models/userTableView.js` | `core` |
| Escrow agents | `models/escrowAgent.js` | `core` |

---

## 3. Summary — What Must Be Rebuilt

Grouped into 12 vertical slices that map to phases in the rebuild plan:

| # | Vertical | ~Models | ~Services | ~Routes | Integrations |
|---|---|---|---|---|---|
| 1 | Identity / Tenancy / RBAC | 10 | 15 | 8 | Better-Auth |
| 2 | Contacts / Leads / Lists | 30 | 35 | 20 | — |
| 3 | Sales Transactions / Contracts / Offers | 35 | 60 | 25 | DocuSeal, Singular, S3 |
| 4 | Inventory / Units / Floorplans / Map | 25 | 15 | 15 | — |
| 5 | Email (Campaigns, Templates, Inbox) | 25 | 40 | 20 | SendGrid, Nylas |
| 6 | Voice / SMS / Calls | 10 | 20 | 10 | Aircall, SMS |
| 7 | Activities / Notes / Tasks / Meetings / PC | 15 | 25 | 15 | — |
| 8 | Workflow V2 engine | 10 | 15 | 3 | BullMQ |
| 9 | Reports / Analytics / Dashboards | 10 | 30 | 15 | — |
| 10 | Demand Notes / Payments / Commissions | 10 | 10 | 8 | — |
| 11 | Blackline / Sync integrations | 5 | 10 | 3 | Blackline, HubSpot |
| 12 | Files / Storage / Push / Realtime | 5 | 10 | 5 | S3, Pusher→SSE |
| **TOTAL** | **~190** | **~295** | **~147** | — |

---

## 4. Principles Governing the Rebuild

1. **No runtime dependency on pxp-server.** Every capability is reimplemented
   against `@db` (Postgres via Drizzle). Data is seeded one-way via
   `packages/sync-pxp`.
2. **Postgres-first schema.** Mongo nested-document patterns (embedded arrays,
   polymorphic refs) are normalised into relational tables with JSONB for
   flexible fields.
3. **Agent-minimum parity.** The goal is to expose every workflow-relevant
   capability as an MCP tool. Non-agent-facing features (admin-only dashboards
   for example) are deprioritised.
4. **Strangler pattern per vertical.** Build vertical-by-vertical. Ship each
   vertical with its own migration, routes, tools, and tests before moving on.
5. **Zero hardcoded secrets, zero console.log, zero files >500 lines.**
   Enforced by `bizzie-check.js` CI gate.
6. **Every route behind Better-Auth or agent JWT + scope middleware.**
   No public surface except explicit webhook ingress and MCP discovery.

---

## 5. Cross-Reference to Headless CRM Current State

As of 2026-04-18, the headless CRM (`aires-turbo`) has shipped:
- `@db` schema for identity, agents, crm (contact/activity/communication/
  task/document), events (outbox/subscription/webhookDelivery), rag, sync
- `@auth` Better-Auth with admin + organization + apiKey + jwt plugins
- `apps/core` with Hono + 2 REST routes (contact, tool) + tRPC + SSE +
  agent JWT issuance
- `apps/workers` with BullMQ queues for contracts, email, reports, sms +
  outbox dispatcher + webhook deliverer
- `apps/mcp-server` with MCP tool exposure
- `@integrations` stubs for aircall, blackline, docuseal, sendgrid
- `@agents` with approvals, audit, rate-limit, tools
- `@rag` with ingest, embed, chunk, search, memory
- `packages/sync-pxp` CLI for one-way bootstrap from PXP Mongo

**Gap:** 95%+ of PXP capabilities listed above are not yet implemented.

---

## 6. Implementation Plan

See `.cursor/plans/aires-headless-crm-parity-build.plan.md` for the phased
execution plan.
