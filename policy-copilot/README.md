# Policy Copilot

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![MCP](https://img.shields.io/badge/MCP-stdio_server-black)](https://modelcontextprotocol.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

**MCP server for UK car insurance comparison and coverage checks.**

An AI agent can list products, compare cover side-by-side, and ask whether a plain-English customer scenario is likely covered — answering only from structured policy data, with cited exclusions and an explicit “not advice” disclaimer.

> Portfolio project demonstrating **structured insurance intelligence + agentic tool use** in a regulated domain: transparent matching, no hallucinated cover wording.

---

## Why this exists

Most demos let an LLM free-form “answer” insurance questions. Policy Copilot is the opposite pattern:

1. **Tools only read `data/policies.json`** — coverage details are never invented.
2. **`check_coverage` matching is explainable** — keyword + synonym overlap against real exclusion strings, with field paths cited in the response.
3. **Every coverage verdict carries a disclaimer** — not financial / legal / regulated advice; confirm with the provider.

## Tools

| Tool | What it returns |
|------|-----------------|
| `list_policies` | Catalog summaries (provider, type, price band, excess, highlights) |
| `get_policy` | Full policy record by id |
| `compare_policies` | Side-by-side excess, limits, shared vs unique exclusions |
| `check_coverage` | Per-policy verdict (`likely covered` / `likely excluded` / `unclear`), cited clause, confidence, disclaimer |
| `explain_exclusion` | Plain-English meaning of a matched exclusion + why insurers include it |

## Data

12 **fictional** UK motor products in [`data/policies.json`](./data/policies.json) (invented provider names — not real trademarks). They differ on purpose:

- Policy type: comprehensive · third-party fire & theft · third-party only  
- Windscreen, courtesy car, foreign-use days, key cover, legal expenses  
- Modification posture (budget vs “modder friendly”)  
- Commercial / delivery / hire-and-reward exclusions  
- Named-driver rules (open drive 25+, learners, young-driver excess)

## Quick start

```bash
git clone https://github.com/Bhavaani16/policy-copilot.git
cd policy-copilot
npm install
npm run smoke    # offline handler checks
npm run dev      # MCP server on stdio
```

Requires **Node.js 18+**.

| Script | Runs |
|--------|------|
| `npm run dev` | `tsx src/server.ts` — stdio MCP server |
| `npm run build` | Compile TypeScript → `dist/` |
| `npm start` | `node dist/server.js` |
| `npm run smoke` | Direct tool-handler smoke test |

## Connect to Claude Desktop

Edit Claude’s MCP config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

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

Or after `npm run build`, point at `dist/server.js` with `node`. Restart Claude Desktop.

## Connect to Cursor

**Settings → MCP** → add:

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

## Example prompts

1. *“List all car insurance policies and highlight which ones allow modifications.”*
2. *“Show me the full detail for `summit-comp-modder`.”*
3. *“Compare `harbour-comp-essential` and `summit-comp-modder` for someone with a modified car.”*
4. *“I have a modified exhaust and wasn’t planning to declare it — which policies would likely exclude me?”*
5. *“Check coverage for: I want to do Deliveroo on weekends.”*
6. *“Explain the unnamed drivers exclusion on `citrine-tpo`.”*
7. *“I’m driving to France for three weeks — compare `foreign_use_days` across the comprehensive policies.”*

## How `check_coverage` works

```text
scenario text
    → tokenise + expand synonyms (e.g. modified ↔ remap ↔ aftermarket)
    → score overlap vs each policy’s exclusions[] (+ light coverage-field signals)
    → verdict + cited field path + confidence
    → always attach disclaimer
```

| Verdict | When |
|---------|------|
| **likely excluded** | Strong match to an exclusion string in the data |
| **unclear — check with provider** | Partial / weak overlap |
| **likely covered** | No strong match — **low confidence by design** (missing exclusion ≠ proof of cover) |

## Project layout

```text
├── data/policies.json       # 12 UK motor products
├── src/
│   ├── server.ts            # MCP entrypoint (stdio)
│   ├── data.ts              # load + Zod-validate policies
│   └── tools/               # one file per tool
├── scripts/smoke.ts
├── package.json
└── README.md
```

## Stack

TypeScript · Node.js · [`@modelcontextprotocol/sdk`](https://github.com/modelcontextprotocol/typescript-sdk) · Zod · JSON file store (no DB for v1)

## Deploy notes

v1 ships over **stdio** for local Claude Desktop / Cursor testing. The tool handlers in `src/tools/` are transport-agnostic — a Streamable HTTP / Vercel adapter can wrap the same functions for a remote MCP endpoint without changing domain logic.

## What I’d build next

- Real product graph (canonical coverages, endorsements, optional extras)
- More lines of business (home, travel, pet) with a shared exclusion ontology
- Embedding / NLU matching with a citation audit trail
- Golden-scenario eval harness (regression tests for “don’t hallucinate cover”)
- Streamable HTTP transport + hosted demo
- Agreed-value classic-car and multi-car household flows

## Disclaimer

This is a **technical portfolio demo**, not an insurer, broker, or regulated advice service. Do not use outputs for real purchase or claims decisions.

## Author

[Bhavaani Kamesh](https://github.com/Bhavaani16) · [LinkedIn](https://www.linkedin.com/in/bhavaani-kamesh/)
