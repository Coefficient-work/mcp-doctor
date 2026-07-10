import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { McpServerEntry } from "./config.js";
export type McpSession = {
    client: Client;
    serverName: string;
    transport: "stdio" | "http" | "sse";
    serverInfo?: {
        name: string;
        version: string;
    };
    tools: Tool[];
    close: () => Promise<void>;
};
export declare function connectMcpSession(entry: McpServerEntry, serverName: string, timeoutMs?: number): Promise<McpSession>;
export declare function callMcpTool(session: McpSession, name: string, args: Record<string, unknown>, timeoutMs?: number): Promise<{
    text: string;
    isError: boolean;
}>;
