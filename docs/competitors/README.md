# Competitor registry

**Product:** [mcp-doctor](https://github.com/coefficient-work/mcp-doctor)  
**Positioning:** Agent-facing API QA - *"Prove that models can execute your MCP, then see where schemas create friction."*
**Last updated:** 2026-07-10

This registry tracks every competitor surfaced in the [ChatGPT Stripe/Stainless research thread](https://github.com/coefficient-ai/coefficient) plus Coefficient desk teardowns.

## Our lane

| Crowded (avoid) | Our wedge |
|-----------------|-----------|
| OpenAPI ? MCP generation | Score + certify what generators produce |
| MCP gateway / hosting | Pre-ship QA and CI regression |
| Generic LLM eval platforms | MCP-specific agent readiness |

## Master table

### Standards / protocol

| ID | Company | Threat | Overlap | Coefficient angle |
|----|---------|--------|---------|-------------------|
| mcp-official | MCP Official Ecosystem | platform | Registry, spec, conformance | Build certification on top |
| anthropic | Anthropic (+ Stainless) | acquirer | SDK/MCP generation | Test Stainless customers' MCPs |
| openai-mcp | OpenAI MCP Connectors | platform | Multi-client target | Include in compatibility matrix |
| cloudflare-mcp | Cloudflare MCP / Code Mode | medium | Token-efficient surfaces | Benchmark tokens + task success |
| pulsemcp | PulseMCP | low | Discovery | Public benchmark data source |

### Generation (crowded)

| ID | Company | Threat | Overlap | Coefficient angle |
|----|---------|--------|---------|-------------------|
| stainless | Stainless | acquired | OpenAPI ? MCP | Partner � test output |
| speakeasy | Speakeasy | **high** | MCP + Gateway + Gram | CI scorecard for generated MCPs |
| gram | Gram (Speakeasy) | **high** | Tool curation | Validate curated sets |
| fern | Fern | medium | Docs, Agent Score | MCP regression CI |
| postman-mcp | Postman MCP | medium | 100+ workspace tools | Score bloat + tasks |
| api-to-mcp | API To MCP | low | Hosted MCP | Pre-publish audit |
| apidog | Apidog MCP | low | Spec for IDEs | Different buyer |
| mintlify | Mintlify | low | Docs MCP | Complement |
| inox | Inox | low | OSS generator | Same test harness |

### Gateway / deployment

| ID | Company | Threat | Overlap | Coefficient angle |
|----|---------|--------|---------|-------------------|
| speakeasy-gateway | Speakeasy Gateway | **high** | OAuth, observability | Test layer, not runtime |
| docker-mcp | Docker MCP Catalog | medium | Verified catalog | Score catalog entries |
| portkey | Portkey | medium | Governed MCP | Pre-prod QA |
| composio | Composio | low | Connectors | Not our lane |
| smithery | Smithery | medium | Registry + hosting | Validate before publish |
| manufact | Manufact / Golf | medium | YC hosting | CI partner |

### Testing / evals (**primary competition**)

| ID | Company | Threat | Overlap | Status | Deep dive |
|----|---------|--------|---------|--------|-----------|
| mcp-inspector | MCP Inspector | **high** | Debug + CLI | tracked | [inspector.md](./inspector.md) |
| mcp-conformance | MCP Conformance | medium | Protocol only | tracked | � |
| mcp-eval | mcp-eval (Lastmile) | **high** | LLM task evals | tracked | [mcp-eval.md](./mcp-eval.md) |
| mcpjam | MCPJam | **high** | Testing, OAuth, CI | tracked | [mcpjam.md](./mcpjam.md) |
| mcp-lint | MCP Lint | medium | Static lint | tracked | � |
| mcp-playground | MCP Playground | low | Schema linter | tracked | � |
| spanly | Spanly | low | Observability | tracked | � |
| iris | Iris | medium | MCP evals | tracked | � |
| mcp-bench | MCP-Bench | low | Research bench | tracked | � |
| braintrust | Braintrust | medium | Generic evals | analyzed | [../research/competitive/braintrust.md](https://github.com/coefficient-ai/coefficient/blob/main/research/competitive/braintrust.md) |
| langsmith | LangSmith | medium | Agent observability | analyzed | [../research/competitive/langsmith.md](https://github.com/coefficient-ai/coefficient/blob/main/research/competitive/langsmith.md) |

### Adjacent

| ID | Company | Threat | Notes |
|----|---------|--------|-------|
| arcade | Arcade | low | Agent auth � different layer |
| workos | WorkOS / Okta | low | Enterprise identity |
| browserbase | Browserbase | low | Browser agents |
| sentry-seer | Sentry Seer | low | Post-prod debugging |

## Kill triggers (watch weekly)

| Signal | Action |
|--------|--------|
| MCPJam ships API-team scorecard + public benchmark | Reassess differentiation |
| Speakeasy ships compatibility test suite in changelog | Accelerate D1 or pivot |
| mcp-eval launches hosted CI product | Partner or narrow to drift+OpenAPI |
| Official MCP Registry adds agent-readiness scores | Integrate, don't compete |

## Roadmap: competitor analysis work

- [x] Registry from ChatGPT market map
- [x] CLI `mcp-doctor competitors` command
- [ ] Deep teardown: MCPJam (pricing, CI features)
- [ ] Deep teardown: mcp-eval (framework vs product gap)
- [ ] Public benchmark v0: 30 servers from PulseMCP/registry
- [ ] Pricing survey: MCPJam ($30/seat), Fern ($150/mo), audit market

## Machine-readable

See [`registry.json`](../competitors/registry.json) for structured data (used by CLI).
