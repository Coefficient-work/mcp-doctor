import type { ApiTool } from "./openapi.js";
export type McpToolDefinition = {
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
};
export declare function toMcpTools(tools: ApiTool[]): McpToolDefinition[];
export declare function cursorMcpConfig(serverName: string, specArg: string): Record<string, unknown>;
export declare function claudeDesktopConfig(serverName: string, specArg: string): Record<string, unknown>;
