import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { formatCompetitorReport, loadRegistry, publicRegistry } from "./competitors.js";
import { formatAnalyzeReport } from "./report.js";
import { classifyBenchmarkError, formatStateOfMcpReport } from "./benchmark.js";
function assertAscii(label, text) {
    const bad = [...text].filter((ch) => ch.charCodeAt(0) > 127);
    assert.equal(bad.length, 0, `${label} contains non-ASCII: ${JSON.stringify(bad.slice(0, 8))}`);
}
describe("competitors public map", () => {
    it("never prints strategy, threat, or our-angle columns", () => {
        const registry = loadRegistry();
        const md = formatCompetitorReport(registry);
        assert.match(md, /Overlap/);
        assert.equal(md.includes("Threat"), false);
        assert.equal(md.includes("Our angle"), false);
        const json = JSON.stringify(publicRegistry(registry));
        assert.equal(json.includes("ourAngle"), false);
        assert.equal(json.includes("\"threat\""), false);
    });
    it("prints ASCII-only competitor, analyze, and benchmark reports", () => {
        const registryPath = resolve(dirname(fileURLToPath(import.meta.url)), "../competitors/registry.json");
        assertAscii("registry.json", readFileSync(registryPath, "utf8"));
        const registry = loadRegistry();
        assertAscii("competitors report", formatCompetitorReport(registry));
        assertAscii("analyze report", formatAnalyzeReport("demo", [], {
            tools: [],
            strategiesApplied: ["trim-descriptions", "group-by-tag"],
            baselineTokens: 10,
            optimizedTokens: 4,
            reductionPct: 60,
        }));
        assertAscii("benchmark report", formatStateOfMcpReport([
            {
                id: "demo",
                name: "Demo",
                grade: "B",
                score: 80,
                toolCount: 3,
                tokens: 100,
                connectMs: 10,
                transport: "stdio",
            },
        ], "2026-08-21"));
    });
});
describe("benchmark failure reporting", () => {
    it("categorizes common launch, auth, timeout, network, and transport failures", () => {
        assert.equal(classifyBenchmarkError("spawn npx ENOENT"), "launch");
        assert.equal(classifyBenchmarkError("401 Unauthorized"), "authentication");
        assert.equal(classifyBenchmarkError("request timed out"), "timeout");
        assert.equal(classifyBenchmarkError("getaddrinfo ENOTFOUND example.com"), "network");
        assert.equal(classifyBenchmarkError("MCP error -32000: Connection closed"), "transport");
    });
    it("prints categorized connection failures", () => {
        const report = formatStateOfMcpReport([{
                id: "broken",
                name: "Broken MCP",
                grade: "F",
                score: 0,
                toolCount: 0,
                tokens: 0,
                connectMs: 10,
                transport: "n/a",
                error: "MCP error -32000: Connection closed",
                errorKind: "transport",
            }], "2026-08-24");
        assert.match(report, /Broken MCP.*\[transport\]/);
    });
});
