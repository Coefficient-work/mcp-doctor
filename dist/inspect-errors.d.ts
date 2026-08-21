export type ListToolsSchemaIssue = {
    index?: number;
    expected?: string;
    received?: string;
};
export declare function parseListToolsSchemaIssue(raw: string): ListToolsSchemaIssue;
export declare function humanizeListToolsError(raw: string, tools?: Array<{
    name?: string;
}>): string;
export type CoercedToolList = {
    tools: Array<{
        name: string;
        description: string;
        inputSchema: {
            type: "object";
            properties: Record<string, unknown>;
        } & Record<string, unknown>;
        outputSchema?: Record<string, unknown>;
    }>;
    malformed: Array<{
        index: number;
        name: string;
    }>;
};
export declare function coerceListedTools(rawTools: unknown[]): CoercedToolList;
export declare const lenientListToolsResultSchema: {
    safeParse(data: unknown): {
        success: true;
        data: {
            tools: unknown[];
        };
    } | {
        success: false;
        error: Error;
    };
};
