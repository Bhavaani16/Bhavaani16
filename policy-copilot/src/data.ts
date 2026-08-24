import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const ExcessSchema = z.object({
  compulsory: z.number(),
  voluntary: z.number(),
});

const CoverageLimitsSchema = z.object({
  windscreen: z.union([z.number(), z.literal("unlimited")]),
  courtesy_car: z.string(),
  personal_belongings: z.number(),
  audio_equipment: z.number(),
  key_replacement: z.number(),
  legal_expenses: z.number(),
  foreign_use_days: z.number(),
});

export const PolicySchema = z.object({
  id: z.string(),
  provider: z.string(),
  name: z.string(),
  policy_type: z.enum([
    "comprehensive",
    "third-party fire & theft",
    "third-party only",
  ]),
  price_band: z.enum(["low", "medium", "high"]),
  excess: ExcessSchema,
  coverage_limits: CoverageLimitsSchema,
  named_driver_requirements: z.string(),
  exclusions: z.array(z.string()),
});

export type Policy = z.infer<typeof PolicySchema>;

const PoliciesSchema = z.array(PolicySchema);

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Resolve data/policies.json whether running from src/ (tsx) or dist/ (compiled). */
function resolveDataPath(): string {
  return join(__dirname, "..", "data", "policies.json");
}

let cached: Policy[] | null = null;

export function loadPolicies(): Policy[] {
  if (cached) return cached;
  const raw = JSON.parse(readFileSync(resolveDataPath(), "utf-8"));
  cached = PoliciesSchema.parse(raw);
  return cached;
}

export function getPolicyById(id: string): Policy | undefined {
  return loadPolicies().find((p) => p.id === id);
}

export function summarizePolicy(policy: Policy) {
  return {
    id: policy.id,
    provider: policy.provider,
    name: policy.name,
    policy_type: policy.policy_type,
    price_band: policy.price_band,
    total_excess: policy.excess.compulsory + policy.excess.voluntary,
    exclusion_count: policy.exclusions.length,
    windscreen: policy.coverage_limits.windscreen,
    courtesy_car: policy.coverage_limits.courtesy_car,
    foreign_use_days: policy.coverage_limits.foreign_use_days,
  };
}

export function jsonResult(data: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}
