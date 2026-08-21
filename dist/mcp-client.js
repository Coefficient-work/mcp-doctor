import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { packageVersion } from "./pkg.js";
export async function connectMcpSession(entry, serverName, timeoutMs = 45_000) {
    const client = new Client({ name: "mcp-doctor", version: packageVersion() }, { capabilities: {} });
    let transport = "stdio";
    if (entry.url) {
        const baseUrl = new URL(entry.url);
        try {
            const httpTransport = new StreamableHTTPClientTransport(baseUrl, {
                requestInit: { headers: entry.headers ?? {} },
            });
            await withTimeout(client.connect(httpTransport), timeoutMs, "connect");
            transport = "http";
        }
        catch {
            const sseTransport = new SSEClientTransport(baseUrl, {
                requestInit: { headers: entry.headers ?? {} },
            });
            await withTimeout(client.connect(sseTransport), timeoutMs, "connect");
            transport = "sse";
        }
    }
    else if (entry.command) {
        const stdioTransport = new StdioClientTransport({
            command: entry.command,
            args: entry.args ?? [],
            env: { ...process.env, ...entry.env },
            stderr: "pipe",
        });
        await withTimeout(client.connect(stdioTransport), timeoutMs, "connect");
        transport = "stdio";
    }
    else {
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
async function withTimeout(promise, ms, label) {
    let timer;
    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    });
    try {
        return await Promise.race([promise, timeout]);
    }
    finally {
        clearTimeout(timer);
    }
}
export async function callMcpTool(session, name, args, timeoutMs = 30_000) {
    const result = await withTimeout(session.client.callTool({ name, arguments: args }), timeoutMs, `callTool(${name})`);
    const content = Array.isArray(result.content) ? result.content : [];
    const text = content
        .map((c) => (c.type === "text" ? c.text ?? "" : JSON.stringify(c)))
        .join("\n");
    return { text, isError: Boolean(result.isError) };
}
