import { loadPolicies, summarizePolicy, jsonResult } from "../data.js";

export const listPoliciesMeta = {
  title: "List Policies",
  description:
    "Return a summary of all UK car insurance policies in the catalog (id, provider, name, type, price band, excess total, key coverage highlights).",
};

export async function listPolicies() {
  const policies = loadPolicies().map(summarizePolicy);
  return jsonResult({
    count: policies.length,
    policies,
  });
}
