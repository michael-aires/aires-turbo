import { syncToolCatalog } from "@acme/agents/tools";

import { registerContractSendTool } from "./contract-send.js";
import { registerEmailSendTool } from "./email-send.js";
import { registerKbSearchTool } from "./kb-search.js";
import { registerMemoryTools } from "./memory-remember.js";
import { registerReportFetchTool } from "./report-fetch.js";
import { registerSmsSendTool } from "./sms-send.js";

/**
 * Register every first-party tool at startup, then upsert the catalog to
 * Postgres so MCP + REST + Admin UI agree on what's available.
 */
export async function registerAllTools() {
  registerEmailSendTool();
  registerSmsSendTool();
  registerContractSendTool();
  registerReportFetchTool();
  registerKbSearchTool();
  registerMemoryTools();
  await syncToolCatalog();
}
