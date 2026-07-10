import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { McpServerEntry } from "./config.js";
import type { ApiTool } from "./openapi.js";

export type LiveInspectResult = {
  serverName: string;
  transport: "stdio" | "http" | "sse";
  serverInfo?: { name: string; version: string };
  tools: Tool[];
  toolCount: number;
  resourceCount: number;
  promptCount: number;
  latencyMs: number;
  errors: string[];
};

export function mcpToolToApiTool(tool: Tool): ApiTool {
  return {
    name: tool.name,
    description: tool.description ?? "",
    tag: "mcp-live",
    method: "TOOL",
    path: `/${tool.name}`,
    inputSchema: (tool.inputSchema as Record<string, unknown>) ?? { type: "object", properties: {} },
  };
}

export async function inspectLiveMcp(
  entry: McpServerEntry,
  serverName: string,
  options?: { timeoutMs?: number },
): Promise<LiveInspectResult> {
  const timeoutMs = options?.timeoutMs ?? 45_000;
  const errors: string[] = [];
  const start = Date.now();

  const client = new Client({ name: "mcp-doctor", version: "0.3.0" }, { capabilities: {} });
  let transport: "stdio" | "http" | "sse" = "stdio";

  if (entry.url) {
    const connected = await connectHttpWithFallback(client, entry.url, entry.headers ?? {}, timeoutMs);
    transport = connected.transport;
    if (connected.warning) errors.push(connected.warning);
  } else if (entry.command) {
    const stdioTransport = new StdioClientTransport({
      command: entry.command,
      args: entry.args ?? [],
      env: { ...process.env, ...entry.env } as Record<string, string>,
      stderr: "pipe",
    });
    await withTimeout(client.connect(stdioTransport), timeoutMs, "MCP stdio connect");
    transport = "stdio";
  } else {
    throw new Error("MCP config needs either `url` (remote) or `command` (stdio)");
  }

  let tools: Tool[] = [];
  let resourceCount = 0;
  let promptCount = 0;
  let serverInfo: { name: string; version: string } | undefined;

  try {
    const version = client.getServerVersion();
    if (version) serverInfo = { name: version.name, version: version.version };
  } catch (e) {
    errors.push(`server info: ${formatErr(e)}`);
  }

  try {
    const listed = await withTimeout(client.listTools(), timeoutMs, "listTools");
    tools = listed.tools ?? [];
  } catch (e) {
    errors.push(`listTools: ${formatErr(e)}`);
  }

  try {
    const resources = await withTimeout(client.listResources(), timeoutMs, "listResources");
    resourceCount = resources.resources?.length ?? 0;
  } catch {
    // optional capability
  }

  try {
    const prompts = await withTimeout(client.listPrompts(), timeoutMs, "listPrompts");
    promptCount = prompts.prompts?.length ?? 0;
  } catch {
    // optional capability
  }

  try {
    await client.close();
  } catch {
    // ignore cleanup errors
  }

  return {
    serverName,
    transport,
    serverInfo,
    tools,
    toolCount: tools.length,
    resourceCount,
    promptCount,
    latencyMs: Date.now() - start,
    errors,
  };
}

async function connectHttpWithFallback(
  client: Client,
  url: string,
  headers: Record<string, string>,
  timeoutMs: number,
): Promise<{ transport: "http" | "sse"; warning?: string }> {
  const baseUrl = new URL(url);
  try {
    const httpTransport = new StreamableHTTPClientTransport(baseUrl, {
      requestInit: { headers },
    });
    await withTimeout(client.connect(httpTransport), timeoutMs, "MCP HTTP connect");
    return { transport: "http" };
  } catch (httpErr) {
    try {
      const sseTransport = new SSEClientTransport(baseUrl, { requestInit: { headers } });
      await withTimeout(client.connect(sseTransport), timeoutMs, "MCP SSE connect");
      return {
        transport: "sse",
        warning: `Streamable HTTP failed (${formatErr(httpErr)}); connected via legacy SSE`,
      };
    } catch (sseErr) {
      throw new Error(
        `Could not connect to ${url}. HTTP: ${formatErr(httpErr)}. SSE: ${formatErr(sseErr)}`,
      );
    }
  }
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}

function formatErr(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export function formatInspectReport(live: LiveInspectResult, scorecardMd: string): string {
  const lines = [
    `# MCP Doctor — live inspection: ${live.serverName}`,
    "",
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Transport | ${live.transport} |`,
    `| Server | ${live.serverInfo?.name ?? "unknown"} v${live.serverInfo?.version ?? "?"} |`,
    `| Tools (live) | ${live.toolCount} |`,
    `| Resources | ${live.resourceCount} |`,
    `| Prompts | ${live.promptCount} |`,
    `| Connect time | ${live.latencyMs}ms |`,
  ];

  if (live.errors.length > 0) {
    lines.push("", "## Connection notes", "");
    for (const err of live.errors) {
      lines.push(`- ${err}`);
    }
  }

  if (live.tools.length > 0) {
    lines.push("", "## Tools discovered", "");
    for (const t of live.tools.slice(0, 40)) {
      lines.push(`- \`${t.name}\` — ${(t.description ?? "").slice(0, 100)}`);
    }
    if (live.tools.length > 40) {
      lines.push(`- _…and ${live.tools.length - 40} more_`);
    }
  } else {
    lines.push("", "_No tools listed — server may require auth or use a non-standard transport._");
  }

  lines.push("", "---", "", scorecardMd);

  lines.push(
    "",
    "---",
    "",
    "## Feedback (copy to Louis)",
    "",
    "```text",
    `Server: ${live.serverName}`,
    "Grade: (see scorecard above)",
    "Would I ship this MCP to customers? yes / no / maybe",
    "Biggest issue:",
    "Best surprise:",
    "Would I pay for CI monitoring on this? yes / no",
    "```",
  );

  return lines.join("\n");
}
