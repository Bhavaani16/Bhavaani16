import { z } from "zod";
import { getPolicyById, jsonResult, type Policy } from "../data.js";

export const comparePoliciesMeta = {
  title: "Compare Policies",
  description:
    "Side-by-side comparison of two or more policies across excess, coverage limits, named-driver requirements, and exclusions.",
  inputSchema: {
    ids: z
      .array(z.string())
      .min(2)
      .describe("Array of two or more policy ids to compare"),
  },
};

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

export async function comparePolicies({ ids }: { ids: string[] }) {
  const found: Policy[] = [];
  const missing: string[] = [];

  for (const id of ids) {
    const policy = getPolicyById(id);
    if (policy) found.push(policy);
    else missing.push(id);
  }

  if (found.length < 2) {
    return jsonResult({
      error:
        "Need at least two valid policy ids to compare. Call list_policies for ids.",
      missing,
      found: found.map((p) => p.id),
    });
  }

  const comparison = {
    policies: found.map((p) => ({
      id: p.id,
      provider: p.provider,
      name: p.name,
      policy_type: p.policy_type,
      price_band: p.price_band,
    })),
    excess: Object.fromEntries(
      found.map((p) => [
        p.id,
        {
          compulsory: p.excess.compulsory,
          voluntary: p.excess.voluntary,
          total: p.excess.compulsory + p.excess.voluntary,
        },
      ]),
    ),
    coverage_limits: Object.fromEntries(
      found.map((p) => [p.id, p.coverage_limits]),
    ),
    named_driver_requirements: Object.fromEntries(
      found.map((p) => [p.id, p.named_driver_requirements]),
    ),
    exclusions: {
      by_policy: Object.fromEntries(
        found.map((p) => [p.id, p.exclusions]),
      ),
      shared: (() => {
        const [first, ...rest] = found;
        return first.exclusions.filter((ex) =>
          rest.every((p) => p.exclusions.includes(ex)),
        );
      })(),
      unique_to: Object.fromEntries(
        found.map((p) => {
          const others = found.filter((o) => o.id !== p.id);
          const unique = p.exclusions.filter(
            (ex) => !others.some((o) => o.exclusions.includes(ex)),
          );
          return [p.id, unique];
        }),
      ),
      all_distinct: uniqueSorted(found.flatMap((p) => p.exclusions)),
    },
    missing_ids: missing,
    notes:
      "Comparison is derived only from structured fields in policies.json — no inferred coverage.",
  };

  return jsonResult(comparison);
}
