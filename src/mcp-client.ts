import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { McpServerEntry } from "./config.js";
import { packageVersion } from "./pkg.js";

export type McpSession = {
  client: Client;
  serverName: string;
  transport: "stdio" | "http" | "sse";
  serverInfo?: { name: string; version: string };
  tools: Tool[];
  close: () => Promise<void>;
};

export async function connectMcpSession(
  entry: McpServerEntry,
  serverName: string,
  timeoutMs = 45_000,
): Promise<McpSession> {
  const client = new Client({ name: "mcp-doctor", version: packageVersion() }, { capabilities: {} });
  let transport: "stdio" | "http" | "sse" = "stdio";

  if (entry.url) {
    const baseUrl = new URL(entry.url);
    try {
      const httpTransport = new StreamableHTTPClientTransport(baseUrl, {
        requestInit: { headers: entry.headers ?? {} },
      });
      await withTimeout(client.connect(httpTransport), timeoutMs, "connect");
      transport = "http";
    } catch {
      const sseTransport = new SSEClientTransport(baseUrl, {
        requestInit: { headers: entry.headers ?? {} },
      });
      await withTimeout(client.connect(sseTransport), timeoutMs, "connect");
      transport = "sse";
    }
  } else if (entry.command) {
    const stdioTransport = new StdioClientTransport({
      command: entry.command,
      args: entry.args ?? [],
      env: { ...process.env, ...entry.env } as Record<string, string>,
      stderr: "pipe",
    });
    await withTimeout(client.connect(stdioTransport), timeoutMs, "connect");
    transport = "stdio";
  } else {
    throw new Error("MCP config needs `url` or `command`");
  }

  const version = client.getServerVersion();
  const listed = await withTimeout(client.listTools(), timeoutMs, "listTools");

  return {
    client,
    serverName,
    transport,
    serverInfo: version ? { name: version.name, version: version.version } : undefined,
    tools: listed.tools ?? [],
    close: () => client.close(),
  };
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

export async function callMcpTool(
  session: McpSession,
  name: string,
  args: Record<string, unknown>,
  timeoutMs = 30_000,
): Promise<{ text: string; isError: boolean }> {
  const result = await withTimeout(
    session.client.callTool({ name, arguments: args }),
    timeoutMs,
    `callTool(${name})`,
  );
  const content = Array.isArray(result.content) ? result.content : [];
  const text = content
    .map((c: { type: string; text?: string }) => (c.type === "text" ? c.text ?? "" : JSON.stringify(c)))
    .join("\n");
  return { text, isError: Boolean(result.isError) };
}
