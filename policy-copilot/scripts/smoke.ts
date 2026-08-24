/**
 * Quick offline smoke test — calls tool handlers directly (no MCP transport).
 * Run: npm run smoke
 */
import { listPolicies } from "../src/tools/list_policies.js";
import { getPolicy } from "../src/tools/get_policy.js";
import { comparePolicies } from "../src/tools/compare_policies.js";
import { checkCoverage } from "../src/tools/check_coverage.js";
import { explainExclusion } from "../src/tools/explain_exclusion.js";

function parse(result: { content: Array<{ type: string; text: string }> }) {
  return JSON.parse(result.content[0]!.text);
}

async function main() {
  const listed = parse(await listPolicies());
  console.log(`list_policies → ${listed.count} policies`);
  if (listed.count < 10) throw new Error("Expected at least 10 policies");

  const one = parse(await getPolicy({ id: "summit-comp-modder" }));
  console.log(`get_policy → ${one.provider}: ${one.name}`);

  const cmp = parse(
    await comparePolicies({
      ids: ["harbour-comp-essential", "summit-comp-modder"],
    }),
  );
  console.log(
    `compare_policies → shared exclusions: ${cmp.exclusions.shared.length}`,
  );

  const coverage = parse(
    await checkCoverage({
      scenario:
        "I have a modified exhaust and wasn't planning to declare it",
    }),
  );
  console.log(
    `check_coverage → excluded=${coverage.summary.likely_excluded} covered=${coverage.summary.likely_covered} unclear=${coverage.summary.unclear}`,
  );
  if (!coverage.disclaimer) throw new Error("Missing disclaimer");

  const modder = coverage.results.find(
    (r: { policy_id: string }) => r.policy_id === "summit-comp-modder",
  );
  console.log(
    `  summit-comp-modder verdict: ${modder?.verdict} (${modder?.confidence})`,
  );

  const explained = parse(
    await explainExclusion({
      policy_id: "citrine-comp-flex",
      exclusion_query: "modified exhaust",
    }),
  );
  console.log(
    `explain_exclusion → cited: ${explained.matched_exclusion?.text}`,
  );

  console.log("\nSmoke test passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
