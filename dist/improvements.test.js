import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { suggestedFixesFromChecks, formatSuggestedFixes } from "./improvements.js";
const thinTool = {
    name: "do_maintenance",
    description: "Runs maintenance tasks.",
    tag: "mcp-live",
    method: "TOOL",
    path: "/do_maintenance",
    inputSchema: { type: "object", properties: {} },
};
describe("suggestedFixesFromChecks", () => {
    it("does not emit mad-lib description templates", () => {
        const checks = [{
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
        const checks = [{
                id: "output-schema",
                category: "schema",
                severity: "warn",
                message: "1 operation(s) lack a response schema",
                detail: "list_products",
            }];
        const fixes = suggestedFixesFromChecks(checks, []);
        assert.match(fixes[0]?.suggested ?? "", /"type": "object"/);
    });
    it("does not glue Say when onto the current sentence without punctuation", () => {
        const tool = {
            ...thinTool,
            name: "reboot_canary",
            description: "reboots the canary instance",
        };
        const checks = [{
                id: "descriptions",
                category: "docs",
                severity: "warn",
                message: "1 tool(s) have thin descriptions (<30 chars)",
                detail: "reboot_canary",
            }];
        const suggested = suggestedFixesFromChecks(checks, [tool]).map((f) => f.suggested).join("\n");
        assert.equal(/instance Say when/.test(suggested), false);
        assert.match(suggested, /instance\.\s+Say when/);
    });
    it("suggests inputSchema when discovery fails", () => {
        const checks = [{
                id: "discovery",
                category: "tools",
                severity: "fail",
                message: "Tool discovery failed - scorecard skipped",
                detail: "Tool #6 is missing required inputSchema (expected object, got undefined). Server may still be reachable.",
            }];
        const fixes = suggestedFixesFromChecks(checks, []);
        assert.ok(fixes.length > 0);
        assert.match(fixes[0]?.suggested ?? "", /inputSchema/);
        const md = formatSuggestedFixes(fixes);
        assert.equal(md.includes("No high-priority fixes suggested"), false);
        assert.match(md, /inputSchema/);
    });
});
