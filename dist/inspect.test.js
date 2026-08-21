import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatInspectReport, truncateAtWord } from "./inspect.js";
import { coerceListedTools, humanizeListToolsError, } from "./inspect-errors.js";
describe("inspect report truncation", () => {
    it("truncates tool descriptions at a word boundary with ellipsis", () => {
        const long = "Provides Executive oversight for warehouse audit records. Allows developers and system admins to Execute raw parametric queries.";
        const truncated = truncateAtWord(long, 100);
        assert.ok(truncated.endsWith("..."));
        assert.equal(/Exe\.\.\.$/.test(truncated), false);
    });
    it("keeps short descriptions intact", () => {
        assert.equal(truncateAtWord("Short desc"), "Short desc");
    });
    it("uses truncateAtWord in the tools discovered list", () => {
        const md = formatInspectReport({
            serverName: "cloudshelf",
            transport: "stdio",
            toolCount: 1,
            resourceCount: 0,
            promptCount: 0,
            latencyMs: 10,
            errors: [],
            tools: [
                {
                    name: "query_raw_audit_log",
                    description: "Provides Executive oversight for warehouse audit records. Allows developers and system admins to Execute raw parametric queries against the hot table.",
                    inputSchema: { type: "object", properties: {} },
                },
            ],
        }, "# scorecard");
        assert.match(md, /query_raw_audit_log/);
        assert.match(md, /\.\.\./);
        assert.equal(md.includes("to Exe\n"), false);
    });
});
describe("listTools schema crash UX", () => {
    it("humanizes a Zod inputSchema path as Tool #N", () => {
        const msg = humanizeListToolsError("listTools: Invalid input: expected object, received undefined at tools.6.inputSchema");
        assert.match(msg, /Tool #6/);
        assert.match(msg, /inputSchema/);
        assert.equal(msg.includes("{"), false);
        assert.equal(/Invalid input: expected object/.test(msg), false);
    });
    it("names the bad tool when a partial list is available", () => {
        const tools = Array.from({ length: 7 }, (_, i) => ({
            name: i === 6 ? "reboot_canary" : `tool_${i}`,
        }));
        const msg = humanizeListToolsError("expected object, received undefined at tools[6].inputSchema", tools);
        assert.match(msg, /Tool #6/);
        assert.match(msg, /reboot_canary/);
    });
    it("does not claim the server needs auth when inputSchema is the failure", () => {
        const md = formatInspectReport({
            serverName: "beaconhub",
            transport: "stdio",
            toolCount: 0,
            resourceCount: 0,
            promptCount: 0,
            latencyMs: 12,
            errors: [
                "Tool #6 is missing required inputSchema (expected object, got undefined). Server may still be reachable.",
            ],
            tools: [],
        }, "# scorecard");
        assert.equal(/may require auth/.test(md), false);
        assert.match(md, /inputSchema/);
        assert.equal(md.includes("copy to Louis"), false);
    });
    it("isolates one malformed tool from a lenient tools/list payload", () => {
        const coerced = coerceListedTools([
            { name: "list_deployments", description: "List", inputSchema: { type: "object", properties: {} } },
            { name: "reboot_canary", description: "Reboot" },
            { name: "get_status", description: "Status", inputSchema: { type: "object", properties: {} } },
        ]);
        assert.equal(coerced.tools.length, 3);
        assert.equal(coerced.malformed.length, 1);
        assert.equal(coerced.malformed[0]?.name, "reboot_canary");
        assert.equal(coerced.malformed[0]?.index, 1);
        assert.equal(coerced.tools[0]?.name, "list_deployments");
        assert.equal(coerced.tools[2]?.name, "get_status");
    });
});
