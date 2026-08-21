import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { suggestedFixesFromChecks } from "./improvements.js";
import type { ScorecardCheck } from "./scorecard.js";
import type { ApiTool } from "./openapi.js";

const thinTool: ApiTool = {
  name: "do_maintenance",
  description: "Runs maintenance tasks.",
  tag: "mcp-live",
  method: "TOOL",
  path: "/do_maintenance",
  inputSchema: { type: "object", properties: {} },
};

describe("suggestedFixesFromChecks", () => {
  it("does not emit mad-lib description templates", () => {
    const checks: ScorecardCheck[] = [{
      id: "descriptions",
      category: "docs",
      severity: "warn",
      message: "1 tool(s) have thin descriptions (<30 chars)",
      detail: "do_maintenance",
    }];
    const fixes = suggestedFixesFromChecks(checks, [thinTool]);
    const suggested = fixes.map((f) => f.suggested).join("\n");
    assert.equal(suggested.includes("Use when the agent needs to perform this operation"), false);
    assert.match(suggested, /versus siblings|one-sentence purpose/);
  });

  it("includes an outputSchema JSON example", () => {
    const checks: ScorecardCheck[] = [{
      id: "output-schema",
      category: "schema",
      severity: "warn",
      message: "1 operation(s) lack a response schema",
      detail: "list_products",
    }];
    const fixes = suggestedFixesFromChecks(checks, []);
    assert.match(fixes[0]?.suggested ?? "", /"type": "object"/);
  });
});
