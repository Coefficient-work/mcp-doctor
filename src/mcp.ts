import type { ApiTool } from "./openapi.js";
import { toolToMcpPayload } from "./tokens.js";

export type McpToolDefinition = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

export function toMcpTools(tools: ApiTool[]): McpToolDefinition[] {
  return tools.map((tool) => {
    const payload = toolToMcpPayload(tool);
    return {
      name: String(payload.name),
      description: String(payload.description),
      inputSchema: payload.inputSchema as Record<string, unknown>,
    };
  });
}

export function cursorMcpConfig(serverName: string, specArg: string): Record<string, unknown> {
  return {
    mcpServers: {
      [serverName]: {
        command: "npx",
        args: ["-y", "github:coefficient-work/mcp-doctor", "serve", specArg],
      },
    },
  };
}

export function claudeDesktopConfig(serverName: string, specArg: string): Record<string, unknown> {
  return {
    mcpServers: {
      [serverName]: {
        command: "npx",
        args: ["-y", "github:coefficient-work/mcp-doctor", "serve", specArg],
      },
    },
  };
}
