import { syncToolCatalog } from "@acme/agents/tools";

import { registerContactTools } from "./contact";
import { registerContractSendTool } from "./contract-send";
import { registerEmailSendTool } from "./email-send";
import { registerKbSearchTool } from "./kb-search";
import { registerMemoryTools } from "./memory-remember";
import { registerReportFetchTool } from "./report-fetch";
import { registerSmsSendTool } from "./sms-send";

/**
 * Register every first-party tool at startup, then upsert the catalog to
 * Postgres so MCP + REST + Admin UI agree on what's available.
 */
export async function registerAllTools() {
  registerContactTools();
  registerEmailSendTool();
  registerSmsSendTool();
  registerContractSendTool();
  registerReportFetchTool();
  registerKbSearchTool();
  registerMemoryTools();
  await syncToolCatalog();
}
