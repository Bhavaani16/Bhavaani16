import { z } from "zod";
import { getPolicyById, jsonResult } from "../data.js";

export const getPolicyMeta = {
  title: "Get Policy",
  description:
    "Return the full detail for a single policy by id, including excess, coverage limits, named-driver rules, and exclusions.",
  inputSchema: {
    id: z
      .string()
      .describe("Policy id, e.g. harbour-comp-essential or summit-comp-modder"),
  },
};

export async function getPolicy({ id }: { id: string }) {
  const policy = getPolicyById(id);
  if (!policy) {
    return jsonResult({
      error: `No policy found with id "${id}". Call list_policies to see valid ids.`,
    });
  }
  return jsonResult(policy);
}
