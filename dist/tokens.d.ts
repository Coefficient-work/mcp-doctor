import type { ApiTool } from "./openapi.js";
/** Rough token estimate (chars / 4) � good enough for RAT benchmarks. */
export declare function estimateTokens(text: string): number;
export declare function toolToMcpPayload(tool: ApiTool): Record<string, unknown>;
export declare function toolsTokenCount(tools: ApiTool[]): number;
export declare function perToolTokens(tools: ApiTool[]): Array<{
    name: string;
    tokens: number;
}>;
