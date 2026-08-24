#!/usr/bin/env node
/**
 * policy-copilot — MCP server for UK car insurance comparison & coverage checks.
 * Transport: stdio (Claude Desktop / Cursor).
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { loadPolicies } from "./data.js";
import {
  listPolicies,
  listPoliciesMeta,
} from "./tools/list_policies.js";
import { getPolicy, getPolicyMeta } from "./tools/get_policy.js";
import {
  comparePolicies,
  comparePoliciesMeta,
} from "./tools/compare_policies.js";
import {
  checkCoverage,
  checkCoverageMeta,
} from "./tools/check_coverage.js";
import {
  explainExclusion,
  explainExclusionMeta,
} from "./tools/explain_exclusion.js";

// Fail fast if data is missing/invalid before accepting MCP connections.
const policies = loadPolicies();

const server = new McpServer({
  name: "policy-copilot",
  version: "1.0.0",
});

server.registerTool("list_policies", listPoliciesMeta, listPolicies);
server.registerTool("get_policy", getPolicyMeta, getPolicy);
server.registerTool("compare_policies", comparePoliciesMeta, comparePolicies);
server.registerTool("check_coverage", checkCoverageMeta, checkCoverage);
server.registerTool("explain_exclusion", explainExclusionMeta, explainExclusion);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(
    `policy-copilot MCP server ready (${policies.length} policies) — stdio`,
  );
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
