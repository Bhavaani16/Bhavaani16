# Policy Copilot

MCP (Model Context Protocol) server that lets an AI agent **compare UK car insurance products** and **check whether a plain-English customer scenario is likely covered** — using only structured data, never invented policy wording.

Portfolio demo of regulated-domain tool use: transparent matching, cited exclusions, and an explicit “not advice” disclaimer on every coverage check.

## What it does

| Tool | Purpose |
|------|---------|
| `list_policies` | Summaries of all catalogued policies |
| `get_policy` | Full detail for one policy by id |
| `compare_policies` | Side-by-side excess, limits, exclusions |
| `check_coverage` | Scenario → verdict per policy + cited clause + confidence |
| `explain_exclusion` | Plain-English explanation of a specific exclusion |

**Data:** 12 fictional UK motor products in `data/policies.json` (invented providers — not real trademarks). Products differ on windscreen, courtesy car, foreign use, modifications, commercial use, and policy type (comprehensive / TPFT / TPO) so comparisons are meaningful.

**Safety pattern:** `check_coverage` reasons only over fields present in `policies.json`. Matching is keyword + synonym overlap against exclusion strings (and a few coverage fields) — explainable, not a black box. Every response includes a disclaimer.

## Quick start

```bash
cd policy-copilot
npm install
npm run smoke    # offline handler checks
npm run dev      # MCP server on stdio
```

Requires Node.js 18+.

| Script | What it runs |
|--------|----------------|
| `npm run dev` | `tsx src/server.ts` — stdio MCP server |
| `npm run build` | Compile TypeScript → `dist/` |
| `npm start` | `node dist/server.js` |
| `npm run smoke` | Direct tool-handler smoke test |

## Connect to Claude Desktop

Add to your Claude Desktop MCP config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS, or the Windows equivalent):

```json
{
  "mcpServers": {
    "policy-copilot": {
      "command": "npx",
      "args": ["tsx", "/ABSOLUTE/PATH/TO/policy-copilot/src/server.ts"]
    }
  }
}
```

Or after `npm run build`:

```json
{
  "mcpServers": {
    "policy-copilot": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/policy-copilot/dist/server.js"]
    }
  }
}
```

Restart Claude Desktop. You should see tools from **policy-copilot**.

## Connect to Cursor

In Cursor Settings → MCP, add a server:

```json
{
  "mcpServers": {
    "policy-copilot": {
      "command": "npx",
      "args": ["tsx", "/ABSOLUTE/PATH/TO/policy-copilot/src/server.ts"]
    }
  }
}
```

(or point `command`/`args` at the compiled `dist/server.js`).

## Example prompts to try

Once the server is connected:

1. **Browse the catalog**  
   *“List all car insurance policies and highlight which ones allow modifications.”*

2. **Deep dive**  
   *“Show me the full detail for summit-comp-modder.”*

3. **Compare for a modified car**  
   *“Compare harbour-comp-essential and summit-comp-modder for someone with a modified car. Which exclusions differ?”*

4. **Coverage check**  
   *“I have a modified exhaust and wasn’t planning to declare it — which policies would likely exclude me?”*

5. **Commercial use**  
   *“Check coverage for: I want to do Deliveroo on weekends.”*

6. **Explain a clause**  
   *“Explain the unnamed drivers exclusion on citrine-tpo.”*

7. **Foreign travel**  
   *“I’m driving to France for three weeks — compare foreign_use_days across the comprehensive policies.”*

## How `check_coverage` reaches a verdict

1. Tokenise the scenario; expand tokens with a small synonym list (e.g. `modified` ↔ `remap` ↔ `aftermarket`).
2. Score overlap against each policy’s `exclusions[]` (and light signals from coverage limits / named-driver text).
3. Emit a verdict:
   - **likely excluded** — strong exclusion match (cite exact string + field path)
   - **unclear — check with provider** — weak/partial match
   - **likely covered** — no strong match in the data (**low confidence** by design — absence of a matching exclusion ≠ proof of cover)
4. Always attach `disclaimer`.

No coverage detail is invented beyond `policies.json`.

## Project layout

```
policy-copilot/
├── data/policies.json      # 12 UK motor products
├── src/
│   ├── server.ts           # MCP entrypoint (stdio)
│   ├── data.ts             # load + Zod-validate policies
│   └── tools/
│       ├── list_policies.ts
│       ├── get_policy.ts
│       ├── compare_policies.ts
│       ├── check_coverage.ts
│       └── explain_exclusion.ts
├── scripts/smoke.ts
├── package.json
└── README.md
```

## Deploy notes (Vercel / remote)

v1 is built for **stdio** (local Claude Desktop / Cursor). For a remote MCP endpoint you’d wrap the same tool handlers behind Streamable HTTP (MCP SDK) or a thin serverless adapter on Vercel — the domain logic in `src/tools/` stays unchanged. Not wired in this demo to keep the weekend build lean.

## What I’d build next

- Real product graph (canonical coverages, endorsements, optional extras) instead of flat JSON
- More lines of business (home, travel, pet) with shared exclusion ontology
- Proper NLU / embeddings for scenario matching, with a citation audit trail
- Evaluation harness: golden scenarios → expected verdicts (regression tests for “don’t hallucinate cover”)
- Streamable HTTP transport + hosted demo
- Agreed-value / classic-car and multi-car household flows

## Disclaimer

This project is a **technical portfolio demo**. It is not an insurer, broker, or regulated advice service. Outputs must not be used to make real purchase or claims decisions.
