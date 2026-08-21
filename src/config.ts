import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

export type McpServerEntry = {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
};

export type McpConfigFile = {
  mcpServers?: Record<string, McpServerEntry>;
};

export function loadMcpConfig(path: string): McpConfigFile {
  const raw = readFileSync(resolve(path), "utf8");
  return JSON.parse(raw) as McpConfigFile;
}

export function resolveMcpConfigPath(explicit?: string): string {
  if (explicit) return resolve(explicit);
  const candidates = [
    join(process.cwd(), "mcp.json"),
    join(process.cwd(), ".cursor", "mcp.json"),
    join(homedir(), ".cursor", "mcp.json"),
    join(homedir(), "Library", "Application Support", "Claude", "claude_desktop_config.json"),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  throw new Error(
    "No MCP config found. Pass --config <path> or create ./mcp.json or ~/.cursor/mcp.json",
  );
}

export function getServerEntry(
  config: McpConfigFile,
  serverName: string,
  configPath?: string,
): McpServerEntry {
  const entry = config.mcpServers?.[serverName];
  if (!entry) {
    const names = Object.keys(config.mcpServers ?? {}).join(", ") || "(none)";
    const from = configPath ? ` in ${configPath}` : "";
    throw new Error(
      `Server "${serverName}" not in config${from}. Available: ${names}. Pass --config <path> if the server lives in another mcp.json.`,
    );
  }
  return entry;
}
