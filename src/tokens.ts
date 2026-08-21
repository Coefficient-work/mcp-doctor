import type { ApiTool } from "./openapi.js";

/** Rough token estimate (chars / 4) - good enough for RAT benchmarks. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function toolToMcpPayload(tool: ApiTool): Record<string, unknown> {
  return {
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
  };
}

export function toolsTokenCount(tools: ApiTool[]): number {
  const payload = tools.map(toolToMcpPayload);
  return estimateTokens(JSON.stringify(payload));
}

export function perToolTokens(tools: ApiTool[]): Array<{ name: string; tokens: number }> {
  return tools.map((tool) => ({
    name: tool.name,
    tokens: estimateTokens(JSON.stringify(toolToMcpPayload(tool))),
  }));
}
