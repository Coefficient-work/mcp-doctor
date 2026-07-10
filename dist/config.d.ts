export type McpServerEntry = {
    command?: string;
    args?: string[];
    env?: Record<string, string>;
    url?: string;
    headers?: Record<string, string>;
};
export type McpConfigFile = {
    mcpServers?: Record<string, McpServerEntry>;
};
export declare function loadMcpConfig(path: string): McpConfigFile;
export declare function resolveMcpConfigPath(explicit?: string): string;
export declare function getServerEntry(config: McpConfigFile, serverName: string): McpServerEntry;
