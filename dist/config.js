import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
export function loadMcpConfig(path) {
    const raw = readFileSync(resolve(path), "utf8");
    return JSON.parse(raw);
}
export function resolveMcpConfigPath(explicit) {
    if (explicit)
        return resolve(explicit);
    const candidates = [
        join(process.cwd(), ".cursor", "mcp.json"),
        join(homedir(), ".cursor", "mcp.json"),
        join(homedir(), "Library", "Application Support", "Claude", "claude_desktop_config.json"),
    ];
    for (const p of candidates) {
        try {
            readFileSync(p, "utf8");
            return p;
        }
        catch {
            // try next
        }
    }
    throw new Error("No MCP config found. Pass --config <path> or create ~/.cursor/mcp.json");
}
export function getServerEntry(config, serverName) {
    const entry = config.mcpServers?.[serverName];
    if (!entry) {
        const names = Object.keys(config.mcpServers ?? {}).join(", ") || "(none)";
        throw new Error(`Server "${serverName}" not in config. Available: ${names}`);
    }
    return entry;
}
