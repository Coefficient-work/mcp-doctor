import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { operationsFromDoc } from "./openapi.js";
import { formatScorecardReport, runScorecard } from "./scorecard.js";
import { mcpToolToApiTool } from "./inspect.js";
const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(readFileSync(resolve(__dirname, "../fixtures/bloated-platform-api.json"), "utf8"));
function liveTool(partial) {
    return mcpToolToApiTool({
        name: partial.name,
        description: partial.description,
        inputSchema: (partial.inputSchema ?? { type: "object", properties: {} }),
        ...(partial.outputSchema ? { outputSchema: partial.outputSchema } : {}),
    });
}
describe("runScorecard", () => {
    it("flags bloated demo API with warnings or failures", () => {
        const tools = operationsFromDoc(fixture);
        const result = runScorecard(fixture, tools, { mode: "openapi" });
        assert.ok(result.toolCount >= 20);
        assert.ok(result.checks.some((c) => c.severity === "warn" || c.severity === "fail"));
        assert.ok(result.checks.some((c) => c.id === "tool-count"));
        assert.ok(result.checks.some((c) => c.id === "token-footprint"));
    });
    it("returns grade letter", () => {
        const tools = operationsFromDoc(fixture);
        const result = runScorecard(fixture, tools);
        assert.match(result.grade, /^[A-F]$/);
    });
});
describe("PulseOps-shaped live scorecard", () => {
    const executive = liveTool({
        name: "generate_postmortem_ai_report",
        description: "Generate a structured Root Cause Analysis. 1. Executive Summary: high-level overview of the incident.",
        inputSchema: {
            type: "object",
            properties: {
                incident_id: { type: "string", description: "Incident identifier", format: "uuid" },
            },
            required: ["incident_id"],
        },
        outputSchema: { type: "object", properties: { markdown: { type: "string" } } },
    });
    it("does not flag Executive/Execute as command execution", () => {
        const executeQuery = liveTool({
            name: "query_metrics",
            description: "Execute a Prometheus PromQL metric query against the timeseries backend.",
            inputSchema: {
                type: "object",
                properties: {
                    query: { type: "string", description: "PromQL expression", pattern: ".+" },
                },
                required: ["query"],
            },
            outputSchema: { type: "object", properties: { series: { type: "array" } } },
        });
        const result = runScorecard({ info: { title: "pulseops" } }, [executive, executeQuery], { mode: "live" });
        const smell = result.checks.find((c) => c.id === "security-smells");
        assert.equal(smell?.severity, "pass");
        const report = formatScorecardReport(result);
        assert.equal(report.includes("OpenAPI"), false);
        assert.equal(report.includes("v0.2"), false);
        assert.equal(/analyze <|\banalyze\b.*token/.test(report), false);
        assert.match(report, /live MCP/);
    });
    it("flags nuke_* as destructive", () => {
        const result = runScorecard({ info: { title: "pulseops" } }, [
            liveTool({
                name: "nuke_environment_cache",
                description: "Flushes all Redis and Memcached cluster tiers immediately.",
            }),
        ], { mode: "live" });
        const check = result.checks.find((c) => c.id === "destructive-warnings");
        assert.equal(check?.severity, "warn");
        assert.match(check?.detail ?? "", /nuke_environment_cache/);
    });
    it("fails credential-like arguments such as pd_token", () => {
        const result = runScorecard({ info: { title: "pulseops" } }, [
            liveTool({
                name: "trigger_pagerduty_escalation",
                description: "Trigger high-urgency PagerDuty escalation for the primary on-call rotation.",
                inputSchema: {
                    type: "object",
                    properties: {
                        pd_token: { type: "string", description: "PagerDuty REST API Bearer Token" },
                    },
                    required: ["pd_token"],
                },
            }),
        ], { mode: "live" });
        const check = result.checks.find((c) => c.id === "credential-in-args");
        assert.equal(check?.severity, "fail");
        assert.match(check?.detail ?? "", /pd_token/);
    });
    it("fails a 4-word tool description instead of hiding it in an average", () => {
        const result = runScorecard({ info: { title: "pulseops" } }, [
            liveTool({
                name: "query_metrics",
                description: "Queries metrics from backend",
            }),
            liveTool({
                name: "list_incidents",
                description: "Retrieve a filtered list of production incidents with severity and status.",
                inputSchema: {
                    type: "object",
                    properties: {
                        limit: { type: "integer", description: "Page size" },
                    },
                    required: ["limit"],
                },
            }),
        ], { mode: "live" });
        const check = result.checks.find((c) => c.id === "descriptions");
        assert.equal(check?.severity, "warn");
        assert.match(check?.detail ?? "", /query_metrics/);
    });
    it("fails empty descriptions even when other tools are well documented", () => {
        const result = runScorecard({ info: { title: "pulseops" } }, [
            liveTool({ name: "query_metrics", description: "" }),
            liveTool({
                name: "list_incidents",
                description: "Retrieve a filtered list of production incidents with severity and status.",
            }),
        ], { mode: "live" });
        const check = result.checks.find((c) => c.id === "descriptions");
        assert.equal(check?.severity, "fail");
        assert.match(check?.detail ?? "", /query_metrics/);
    });
    it("treats list_* tools as pagination candidates regardless of HTTP method", () => {
        const result = runScorecard({ info: { title: "pulseops" } }, [
            liveTool({
                name: "list_incidents",
                description: "Retrieve production incidents from PulseOps for on-call triage.",
                inputSchema: {
                    type: "object",
                    properties: {
                        status: { type: "string", description: "Lifecycle filter", enum: ["open", "closed"] },
                    },
                    required: ["status"],
                },
            }),
        ], { mode: "live" });
        const check = result.checks.find((c) => c.id === "pagination");
        assert.notEqual(check?.severity, "info");
        assert.match(check?.message ?? "", /pagination/i);
    });
    it("does not talk about OpenAPI security schemes on live inspect", () => {
        const result = runScorecard({ info: { title: "pulseops" } }, [
            liveTool({
                name: "get_incident_details",
                description: "Fetch complete incident metadata and investigation timeline for responders.",
                inputSchema: {
                    type: "object",
                    properties: {
                        incident_id: { type: "string", description: "Incident id", format: "uuid" },
                    },
                    required: ["incident_id"],
                },
                outputSchema: { type: "object", properties: { id: { type: "string" } } },
            }),
        ], { mode: "live" });
        assert.equal(result.checks.some((c) => c.id === "auth-clarity"), false);
        assert.equal(formatScorecardReport(result).includes("security schemes"), false);
    });
});
