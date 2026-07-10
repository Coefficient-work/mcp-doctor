# mcp-eval (Lastmile AI)

**Category:** Testing / agent evals  
**Threat:** High (closest technical overlap)  
**URL:** https://mcp-eval.ai · https://github.com/lastmile-ai/mcp-eval

## What they do

Lightweight eval framework: run LLM agents against real MCP tools, assertions, latency/token/cost tracking, OpenTelemetry, auto-generated tests.

## Gap we exploit

- **Framework**, not packaged CI product for API teams
- No **OpenAPI drift** scorecard
- No **public benchmark** / inbound audit funnel
- Buyer is ML engineer, not **API platform / DevRel**

## Our response

Package evals into `mcp-doctor ci` + GitHub Action + £2k audit offer. Partner with generators (Stainless/Speakeasy) not compete on raw eval harness.
