import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getServerEntry, loadMcpConfig, resolveMcpConfigPath } from "./config.js";
import { mcpToolToApiTool } from "./inspect.js";
import { runScorecard } from "./scorecard.js";
describe("loadMcpConfig", () => {
    it("loads and resolves server entry", () => {
        const dir = mkdtempSync(join(tmpdir(), "mcp-doctor-"));
        const path = join(dir, "mcp.json");
        writeFileSync(path, JSON.stringify({
            mcpServers: {
                vooma: {
                    url: "https://mcp.example.com/v1",
                    headers: { Authorization: "Bearer test" },
                },
                local: { command: "node", args: ["server.js"] },
            },
        }));
        const config = loadMcpConfig(path);
        const vooma = getServerEntry(config, "vooma", path);
        assert.equal(vooma.url, "https://mcp.example.com/v1");
        assert.throws(() => getServerEntry(config, "missing", path), /Pass --config/);
    });
    it("prefers cwd mcp.json over home Cursor config", () => {
        const dir = mkdtempSync(join(tmpdir(), "mcp-doctor-cwd-"));
        writeFileSync(join(dir, "mcp.json"), JSON.stringify({ mcpServers: { pulseops: { command: "node", args: ["index.js"] } } }));
        const previous = process.cwd();
        try {
            process.chdir(dir);
            assert.equal(resolveMcpConfigPath(), join(realpathSync(dir), "mcp.json"));
        }
        finally {
            process.chdir(previous);
        }
    });
});
describe("mcpToolToApiTool + scorecard", () => {
    it("scores live-style tools", () => {
        const tools = [
            mcpToolToApiTool({
                name: "get_load",
                description: "Fetch a freight load by ID from TMS",
                inputSchema: { type: "object", properties: { id: { type: "string" } } },
            }),
        ];
        const result = runScorecard({ info: { title: "Vooma MCP (test)" } }, tools, { mode: "live" });
        assert.equal(result.toolCount, 1);
        assert.ok(result.score > 0);
    });
});
