import { z } from "zod";
import {
  getPolicyById,
  jsonResult,
  loadPolicies,
  type Policy,
} from "../data.js";

export const DISCLAIMER =
  "Not financial, legal, or regulated insurance advice. Coverage decisions depend on the full policy wording, your disclosures, and the insurer's assessment. Always confirm with the provider before relying on this output.";

export const checkCoverageMeta = {
  title: "Check Coverage",
  description:
    "Given a plain-English customer scenario, check whether each policy (or one specified policy) is likely covered, likely excluded, or unclear. Matching is transparent keyword overlap against exclusion strings and structured fields — no invented coverage.",
  inputSchema: {
    scenario: z
      .string()
      .describe(
        'Plain-English scenario, e.g. "I have a modified exhaust and wasn\'t planning to declare it"',
      ),
    policy_id: z
      .string()
      .optional()
      .describe("Optional policy id to check a single policy only"),
  },
};

type Verdict = "likely covered" | "likely excluded" | "unclear — check with provider";
type Confidence = "high" | "medium" | "low";

interface MatchHit {
  field: string;
  text: string;
  score: number;
  matched_tokens: string[];
}

/** Tokens used for transparent keyword matching (stopwords stripped). */
const STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "of",
  "to",
  "in",
  "on",
  "at",
  "for",
  "with",
  "without",
  "from",
  "by",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "i",
  "my",
  "me",
  "we",
  "our",
  "you",
  "your",
  "it",
  "its",
  "this",
  "that",
  "not",
  "no",
  "do",
  "does",
  "did",
  "have",
  "has",
  "had",
  "will",
  "would",
  "can",
  "could",
  "should",
  "may",
  "might",
  "am",
  "as",
  "if",
  "than",
  "then",
  "so",
  "but",
  "about",
  "into",
  "over",
  "under",
  "up",
  "out",
  "off",
  "any",
  "all",
  "also",
  "just",
  "only",
  "while",
  "when",
  "where",
  "who",
  "what",
  "which",
  "how",
  "planning",
  "want",
  "wanted",
  "need",
  "needed",
]);

/** Synonym groups so related scenario wording still hits exclusion phrases. */
const SYNONYM_GROUPS: string[][] = [
  ["modified", "modification", "modifications", "mod", "mods", "remap", "remapped", "tuned", "tuning", "aftermarket", "undeclared"],
  ["exhaust", "catback", "backbox", "muffler", "suspension", "ecu"],
  ["declare", "declared", "disclose", "disclosed", "disclosure", "listed", "schedule"],
  ["drink", "drunk", "alcohol", "dui", "drink-driving", "intoxicated", "drugs", "influence"],
  ["unnamed", "unlisted", "anyone", "somebody", "friend", "mate"],
  ["delivery", "deliveries", "courier", "ubereats", "deliveroo", "food"],
  ["taxi", "uber", "private hire", "hire and reward", "phv"],
  ["race", "racing", "track", "trackday", "track day", "timed"],
  ["theft", "stolen", "steal"],
  ["windscreen", "windshield", "glass", "chip", "chips"],
  ["abroad", "foreign", "europe", "france", "spain", "holiday"],
  ["learner", "provisional", "l-plates"],
  ["keys", "key"],
  ["garaged", "garage", "overnight"],
  ["tools", "cargo", "van"],
  ["misfuel", "misfuelling", "wrong fuel", "petrol in diesel"],
];

/** High-signal stems: a hit on these weighs more toward exclusion. */
const HIGH_SIGNAL = new Set([
  "modified",
  "modification",
  "modifications",
  "remap",
  "alcohol",
  "drugs",
  "influence",
  "unnamed",
  "racing",
  "track",
  "delivery",
  "courier",
  "taxi",
  "theft",
  "misfuel",
  "misfuelling",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9+\s-]/g, " ")
    .split(/[\s/-]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

function expandTokens(tokens: string[]): Set<string> {
  const expanded = new Set(tokens);
  for (const token of tokens) {
    for (const group of SYNONYM_GROUPS) {
      if (group.includes(token)) {
        for (const syn of group) expanded.add(syn);
      }
    }
  }
  return expanded;
}

function scoreAgainstText(
  scenarioTokens: Set<string>,
  field: string,
  text: string,
): MatchHit | null {
  const fieldTokens = tokenize(text);
  if (fieldTokens.length === 0) return null;

  // A field token matches if it (or any synonym) appears in the scenario token set.
  const matchedFieldTokens: string[] = [];
  for (const ft of fieldTokens) {
    const variants = expandTokens([ft]);
    if ([...variants].some((v) => scenarioTokens.has(v))) {
      matchedFieldTokens.push(ft);
    }
  }
  if (matchedFieldTokens.length === 0) return null;

  const overlap = matchedFieldTokens.length / fieldTokens.length;
  const highSignalHits = matchedFieldTokens.filter((t) => {
    const variants = expandTokens([t]);
    return [...variants].some((v) => HIGH_SIGNAL.has(v));
  }).length;

  const score = Math.min(
    1,
    overlap * 0.5 +
      Math.min(matchedFieldTokens.length / 2, 1) * 0.25 +
      Math.min(highSignalHits, 2) * 0.2,
  );

  return {
    field,
    text,
    score: Number(score.toFixed(3)),
    matched_tokens: matchedFieldTokens,
  };
}

function gatherHits(policy: Policy, scenarioTokens: Set<string>): MatchHit[] {
  const hits: MatchHit[] = [];

  policy.exclusions.forEach((ex, i) => {
    const hit = scoreAgainstText(
      scenarioTokens,
      `exclusions[${i}]`,
      ex,
    );
    if (hit) hits.push(hit);
  });

  const ndHit = scoreAgainstText(
    scenarioTokens,
    "named_driver_requirements",
    policy.named_driver_requirements,
  );
  if (ndHit) hits.push(ndHit);

  // Lightweight type-level signals for scenarios about own-damage / fire / theft.
  const typeHints: Array<{ needle: string[]; field: string; text: string }> = [
    {
      needle: ["windscreen", "windshield", "glass", "chip"],
      field: "coverage_limits.windscreen",
      text: `windscreen limit: ${policy.coverage_limits.windscreen}`,
    },
    {
      needle: ["abroad", "foreign", "europe", "france", "spain", "holiday"],
      field: "coverage_limits.foreign_use_days",
      text: `foreign_use_days: ${policy.coverage_limits.foreign_use_days}`,
    },
    {
      needle: ["courtesy", "hire", "replacement car"],
      field: "coverage_limits.courtesy_car",
      text: `courtesy_car: ${policy.coverage_limits.courtesy_car}`,
    },
  ];

  for (const hint of typeHints) {
    if (hint.needle.some((n) => scenarioTokens.has(n))) {
      hits.push({
        field: hint.field,
        text: hint.text,
        score: 0.35,
        matched_tokens: hint.needle.filter((n) => scenarioTokens.has(n)),
      });
    }
  }

  return hits.sort((a, b) => b.score - a.score);
}

function verdictForPolicy(
  policy: Policy,
  scenario: string,
  scenarioTokens: Set<string>,
): {
  policy_id: string;
  provider: string;
  name: string;
  verdict: Verdict;
  confidence: Confidence;
  cited_field: string | null;
  cited_text: string | null;
  matched_tokens: string[];
  match_score: number | null;
  rationale: string;
} {
  const hits = gatherHits(policy, scenarioTokens);
  const top = hits[0];

  // Strong exclusion hit → likely excluded
  if (top && top.field.startsWith("exclusions") && top.score >= 0.45) {
    return {
      policy_id: policy.id,
      provider: policy.provider,
      name: policy.name,
      verdict: "likely excluded",
      confidence: top.score >= 0.7 ? "high" : "medium",
      cited_field: top.field,
      cited_text: top.text,
      matched_tokens: top.matched_tokens,
      match_score: top.score,
      rationale: `Scenario tokens overlapped exclusion "${top.text}" (score ${top.score}). Matching is keyword/synonym only against policies.json.`,
    };
  }

  // Coverage-limit signal with zero entitlement → likely excluded / unclear
  if (top && top.field.startsWith("coverage_limits") && top.score >= 0.3) {
    const zeroish =
      /:\s*(0|none)\b/i.test(top.text) ||
      (policy.policy_type !== "comprehensive" &&
        /own.?damage|accidental damage|windscreen/i.test(scenario));

    if (zeroish || /:\s*(0|none)\b/i.test(top.text)) {
      return {
        policy_id: policy.id,
        provider: policy.provider,
        name: policy.name,
        verdict: "likely excluded",
        confidence: "medium",
        cited_field: top.field,
        cited_text: top.text,
        matched_tokens: top.matched_tokens,
        match_score: top.score,
        rationale: `Scenario relates to ${top.field}, which is ${top.text} on this product.`,
      };
    }
  }

  // Weak / named-driver only hit → unclear
  if (top && top.score >= 0.25) {
    return {
      policy_id: policy.id,
      provider: policy.provider,
      name: policy.name,
      verdict: "unclear — check with provider",
      confidence: "low",
      cited_field: top.field,
      cited_text: top.text,
      matched_tokens: top.matched_tokens,
      match_score: top.score,
      rationale: `Partial overlap with "${top.text}" but not strong enough for a firm exclusion call.`,
    };
  }

  // No matching exclusion → likely covered *only* if nothing in data suggests otherwise.
  // Be honest: absence of a matching exclusion is not proof of cover.
  return {
    policy_id: policy.id,
    provider: policy.provider,
    name: policy.name,
    verdict: "likely covered",
    confidence: "low",
    cited_field: null,
    cited_text: null,
    matched_tokens: [],
    match_score: null,
    rationale:
      "No exclusion or structured field in policies.json strongly matched this scenario. That is not a guarantee of cover — confirm with the provider.",
  };
}

export async function checkCoverage({
  scenario,
  policy_id,
}: {
  scenario: string;
  policy_id?: string;
}) {
  const scenarioTokens = expandTokens(tokenize(scenario));

  let policies: Policy[];
  if (policy_id) {
    const one = getPolicyById(policy_id);
    if (!one) {
      return jsonResult({
        error: `No policy found with id "${policy_id}".`,
        disclaimer: DISCLAIMER,
      });
    }
    policies = [one];
  } else {
    policies = loadPolicies();
  }

  const results = policies.map((p) =>
    verdictForPolicy(p, scenario, scenarioTokens),
  );

  return jsonResult({
    scenario,
    matching_method:
      "Transparent keyword + synonym overlap against exclusion strings and selected coverage fields in policies.json. No LLM inference of coverage terms.",
    scenario_tokens_used: [...scenarioTokens].sort(),
    results,
    summary: {
      likely_excluded: results.filter((r) => r.verdict === "likely excluded")
        .length,
      likely_covered: results.filter((r) => r.verdict === "likely covered")
        .length,
      unclear: results.filter(
        (r) => r.verdict === "unclear — check with provider",
      ).length,
    },
    disclaimer: DISCLAIMER,
  });
}
