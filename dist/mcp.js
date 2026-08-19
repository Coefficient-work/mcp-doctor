import { toolToMcpPayload } from "./tokens.js";
export function toMcpTools(tools) {
    return tools.map((tool) => {
        const payload = toolToMcpPayload(tool);
        return {
            name: String(payload.name),
            description: String(payload.description),
            inputSchema: payload.inputSchema,
        };
    });
}
export function cursorMcpConfig(serverName, specArg) {
    return {
        mcpServers: {
            [serverName]: {
                command: "npx",
                args: ["-y", "@coefficient-work/mcp-doctor", "serve", specArg],
            },
        },
    };
}
export function claudeDesktopConfig(serverName, specArg) {
    return {
        mcpServers: {
            [serverName]: {
                command: "npx",
                args: ["-y", "@coefficient-work/mcp-doctor", "serve", specArg],
            },
        },
    };
}
