import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, } from "@modelcontextprotocol/sdk/types.js";
import { toMcpTools } from "./mcp.js";
export async function runMcpServer(tools, serverTitle) {
    const mcpTools = toMcpTools(tools);
    const toolMap = new Map(tools.map((t) => [t.name, t]));
    const server = new Server({ name: "mcp-slim", version: "0.1.0" }, { capabilities: { tools: {} } });
    server.setRequestHandler(ListToolsRequestSchema, async () => ({
        tools: mcpTools,
    }));
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const tool = toolMap.get(request.params.name);
        if (!tool) {
            return {
                content: [{ type: "text", text: `Unknown tool: ${request.params.name}` }],
                isError: true,
            };
        }
        const args = (request.params.arguments ?? {});
        const text = formatDemoResponse(tool, args, serverTitle);
        return {
            content: [{ type: "text", text }],
        };
    });
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
function formatDemoResponse(tool, args, serverTitle) {
    if (tool.children && tool.children.length > 0) {
        const action = String(args.action ?? "");
        const child = tool.children.find((c) => c.name === action);
        if (!action) {
            const names = tool.children.map((c) => `- ${c.name}: ${c.description.slice(0, 60)}`).join("\n");
            return [
                `[mcp-slim demo] ${tool.name} � progressive discovery for ${tool.tag}`,
                "",
                "Pass `action` to invoke one of:",
                names,
                "",
                `Baseline would expose ${tool.children.length} separate tools (~more tokens).`,
            ].join("\n");
        }
        if (!child) {
            return `[mcp-slim demo] Unknown action "${action}". Valid: ${tool.children.map((c) => c.name).join(", ")}`;
        }
        return [
            `[mcp-slim demo] ${serverTitle}`,
            `Would call: ${child.method} ${child.path}`,
            `Operation: ${child.name}`,
            `Params: ${JSON.stringify(args.params ?? {}, null, 2)}`,
            "",
            "This is a free demo server � responses are simulated.",
            "Production mode (real HTTP calls) coming soon.",
        ].join("\n");
    }
    return [
        `[mcp-slim demo] ${serverTitle}`,
        `Would call: ${tool.method} ${tool.path}`,
        `Args: ${JSON.stringify(args, null, 2)}`,
        "",
        "Demo mode � simulated response. Star github.com/louisreid/mcp-slim for updates.",
    ].join("\n");
}
