import { z } from "zod";
import { getPolicyById, jsonResult } from "../data.js";

export const explainExclusionMeta = {
  title: "Explain Exclusion",
  description:
    "Explain what a specific exclusion on a policy means in plain English, why insurers typically include it, and cite the exact exclusion string from the data.",
  inputSchema: {
    policy_id: z.string().describe("Policy id to look up"),
    exclusion_query: z
      .string()
      .describe(
        "Substring or keywords matching an exclusion, e.g. 'modified' or 'driving under the influence'",
      ),
  },
};

/** Curated plain-English blurbs keyed by theme — only used when an exclusion matches. */
const EXPLANATION_LIBRARY: Array<{
  keywords: string[];
  meaning: string;
  why_it_exists: string;
}> = [
  {
    keywords: ["modified", "modification", "exhaust", "remap", "performance", "appearance"],
    meaning:
      "If the car has been changed from the manufacturer's standard spec (engine remap, aftermarket exhaust, lowered suspension, body kit, etc.) and that change was not declared when you bought the policy, a claim can be refused.",
    why_it_exists:
      "Modifications can change risk (power, theft appeal, repair cost). Insurers price and underwrite on the declared vehicle; undeclared changes break that contract.",
  },
  {
    keywords: ["influence", "alcohol", "drugs"],
    meaning:
      "Any claim arising while the driver was over the legal alcohol limit or impaired by drugs is excluded.",
    why_it_exists:
      "Drink- and drug-driving is illegal and a catastrophic risk. Covering it would subsidise criminal behaviour and is almost universally excluded.",
  },
  {
    keywords: ["unnamed"],
    meaning:
      "Only drivers listed on the policy (or allowed under an 'any driver' endorsement) are covered. A friend or relative who is not named is not insured to drive the car.",
    why_it_exists:
      "Premiums reflect who will drive — age, convictions, experience. Unnamed drivers bypass that underwriting.",
  },
  {
    keywords: ["racing", "track", "timed"],
    meaning:
      "Use on a race track, sprint, hill climb, or any timed competitive event is not covered — even organised 'track days'.",
    why_it_exists:
      "Track use involves much higher speeds and collision frequency than public-road risk, and needs specialist motorsport cover.",
  },
  {
    keywords: ["delivery", "courier", "commercial", "hire and reward", "taxi", "private hire"],
    meaning:
      "Using the car to carry goods or passengers for payment (food delivery, courier work, taxi/PHV) is outside social/domestic/pleasure or commuting use.",
    why_it_exists:
      "Commercial mileage, time-pressure driving, and frequent stops raise claim frequency. It requires a business or hire-and-reward policy.",
  },
  {
    keywords: ["theft", "keys", "unlocked", "forced entry"],
    meaning:
      "Theft claims can be declined if the vehicle was left unlocked, keys were left in/on the car, or there is no evidence of forced entry where the policy requires it.",
    why_it_exists:
      "Insurers expect reasonable care. Leaving keys in the car or unlocked doors makes theft trivial and is treated as contributing negligence.",
  },
  {
    keywords: ["own-vehicle", "third-party only", "accidental damage", "fire damage", "theft of the insured"],
    meaning:
      "Third-party only (and to a lesser extent TPFT) policies do not pay to repair or replace *your* car after an at-fault accident. TPO covers other people's injury/property only; TPFT adds fire and theft of your vehicle but not accidental damage.",
    why_it_exists:
      "These are cheaper products by design — you are buying liability cover, not full asset protection for your own vehicle.",
  },
  {
    keywords: ["mot"],
    meaning:
      "Driving without a valid MOT can void cover for resulting damage, because the car may not be legally roadworthy.",
    why_it_exists:
      "Roadworthiness is a legal and underwriting baseline; insurers will not fund claims that arise while that baseline is broken.",
  },
  {
    keywords: ["foreign", "abroad", "driving abroad"],
    meaning:
      "Cover outside the UK is limited to the foreign_use_days on the schedule (or zero on some cheap products). Beyond that, you need a green card / extension.",
    why_it_exists:
      "Claims handling, liability regimes, and repair costs differ overseas; unlimited foreign use would be mispriced for most UK policies.",
  },
  {
    keywords: ["learner", "provisional"],
    meaning:
      "Learner drivers are only covered if the policy allows them and a qualified supervising driver (often also named) is present as required.",
    why_it_exists:
      "Learners have higher incident rates; insurers control that risk with naming rules and supervision conditions.",
  },
  {
    keywords: ["misfuel", "fuel"],
    meaning:
      "Putting the wrong fuel in the tank (e.g. petrol in a diesel) is not covered on products that exclude misfuelling.",
    why_it_exists:
      "Misfuelling is a common, avoidable driver error; some insurers exclude it or sell it as an optional extra.",
  },
  {
    keywords: ["disclose", "convictions", "claims", "ncd"],
    meaning:
      "If you withheld previous claims, convictions, or other material facts at quote, the insurer can void the policy or refuse a claim.",
    why_it_exists:
      "Insurance is a contract of utmost good faith — the premium assumes accurate disclosure.",
  },
  {
    keywords: ["garaged", "overnight", "street"],
    meaning:
      "If you told the insurer the car is kept in a garage overnight but it is regularly left on the street (or vice versa without endorsement), related theft/damage claims may be challenged.",
    why_it_exists:
      "Overnight location is a major theft-risk rating factor.",
  },
  {
    keywords: ["hazardous", "tools", "cargo"],
    meaning:
      "Carrying hazardous goods, or leaving tools/cargo in an unlocked commercial vehicle, sits outside standard motor cover.",
    why_it_exists:
      "Cargo and hazardous-goods risk needs goods-in-transit or specialist endorsements.",
  },
];

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9+\s-]/g, " ")
    .split(/[\s/-]+/)
    .filter((t) => t.length > 1);
}

function bestExclusionMatch(
  exclusions: string[],
  query: string,
): { index: number; text: string; score: number } | null {
  const q = query.toLowerCase().trim();
  const qTokens = tokenize(q);

  const scored = exclusions.map((text, index) => {
    const lower = text.toLowerCase();
    let score = 0;
    if (lower.includes(q) || q.includes(lower)) {
      score = 1;
    } else {
      const tokens = tokenize(lower);
      const overlap = tokens.filter((t) => qTokens.includes(t)).length;
      score = tokens.length ? overlap / tokens.length : 0;
    }
    return { index, text, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  return best && best.score > 0 ? best : null;
}

function explainTheme(exclusionText: string) {
  const tokens = new Set(tokenize(exclusionText));
  for (const entry of EXPLANATION_LIBRARY) {
    if (entry.keywords.some((k) => {
      const kt = tokenize(k);
      return kt.every((t) => tokens.has(t)) || exclusionText.toLowerCase().includes(k);
    })) {
      return entry;
    }
  }
  return {
    keywords: [] as string[],
    meaning:
      "This clause removes cover for the situation described in the exclusion wording itself. Read it literally against your circumstances.",
    why_it_exists:
      "Insurers use exclusions to keep premiums affordable by carving out risks they did not price for, or that are illegal / uninsurable on a standard motor policy.",
  };
}

export async function explainExclusion({
  policy_id,
  exclusion_query,
}: {
  policy_id: string;
  exclusion_query: string;
}) {
  const policy = getPolicyById(policy_id);
  if (!policy) {
    return jsonResult({
      error: `No policy found with id "${policy_id}".`,
    });
  }

  const match = bestExclusionMatch(policy.exclusions, exclusion_query);
  if (!match) {
    return jsonResult({
      policy_id: policy.id,
      provider: policy.provider,
      name: policy.name,
      error: `No exclusion on this policy matched "${exclusion_query}".`,
      available_exclusions: policy.exclusions,
      note: "Explanations only cite strings present in policies.json — nothing is invented.",
    });
  }

  const theme = explainTheme(match.text);

  return jsonResult({
    policy_id: policy.id,
    provider: policy.provider,
    name: policy.name,
    matched_exclusion: {
      field: `exclusions[${match.index}]`,
      text: match.text,
      match_score: Number(match.score.toFixed(3)),
    },
    plain_english: theme.meaning,
    why_insurers_include_it: theme.why_it_exists,
    related_policy_context: {
      policy_type: policy.policy_type,
      price_band: policy.price_band,
      named_driver_requirements: policy.named_driver_requirements,
    },
    disclaimer:
      "Educational explanation based on the stored exclusion string. Not advice — confirm with the provider and the full policy booklet.",
  });
}
