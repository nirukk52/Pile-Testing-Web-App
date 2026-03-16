#!/usr/bin/env node
/**
 * PileTest MCP Server
 * Why: Exposes pile load test ingestion, validation, and report generation
 * as MCP tools for OpenClaw agent consumption via stdio transport.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { registerIngestFile } from "./tools/ingest-file.js";
import { registerValidateTest } from "./tools/validate-test.js";
import { registerGenerateReport } from "./tools/generate-report.js";
import { registerGetTest } from "./tools/get-test.js";
import { registerStoreFile } from "./tools/store-file.js";
import { registerAttachFile } from "./tools/attach-file.js";
import { registerSaveTemplate } from "./tools/save-template.js";
import { registerApplyTemplate } from "./tools/apply-template.js";

const server = new McpServer({
  name: "piletest-mcp-server",
  version: "1.0.0",
});

registerIngestFile(server);
registerValidateTest(server);
registerGenerateReport(server);
registerGetTest(server);
registerStoreFile(server);
registerAttachFile(server);
registerSaveTemplate(server);
registerApplyTemplate(server);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("PileTest MCP server running via stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
