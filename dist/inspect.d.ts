import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { McpServerEntry } from "./config.js";
import type { ApiTool } from "./openapi.js";
export type LiveInspectResult = {
    serverName: string;
    transport: "stdio" | "http" | "sse";
    serverInfo?: {
        name: string;
        version: string;
    };
    tools: Tool[];
    toolCount: number;
    resourceCount: number;
    promptCount: number;
    latencyMs: number;
    errors: string[];
    malformedTools?: Array<{
        index: number;
        name: string;
    }>;
};
export declare function mcpToolToApiTool(tool: Tool, extra?: {
    missingInputSchema?: boolean;
}): ApiTool;
export declare function inspectLiveMcp(entry: McpServerEntry, serverName: string, options?: {
    timeoutMs?: number;
}): Promise<LiveInspectResult>;
export declare function formatInspectReport(live: LiveInspectResult, scorecardMd: string): string;
export declare function truncateAtWord(text: string, max?: number): string;
