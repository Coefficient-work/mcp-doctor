export type OpenApiDocument = {
    openapi?: string;
    info?: {
        title?: string;
        version?: string;
    };
    paths?: Record<string, PathItem>;
    tags?: Array<{
        name: string;
        description?: string;
    }>;
};
type PathItem = Record<string, Operation>;
export type Operation = {
    operationId?: string;
    summary?: string;
    description?: string;
    tags?: string[];
    parameters?: Array<Record<string, unknown>>;
    requestBody?: Record<string, unknown>;
    responses?: Record<string, unknown>;
};
export type ApiTool = {
    name: string;
    description: string;
    tag: string;
    method: string;
    path: string;
    inputSchema: Record<string, unknown>;
    outputSchema?: Record<string, unknown>;
    /** True when listTools omitted inputSchema and we filled an empty object. */
    missingInputSchema?: boolean;
    /** Original operations when using group-by-tag discovery. */
    children?: ApiTool[];
};
export declare function loadOpenApiFromDoc(doc: OpenApiDocument): Promise<ApiTool[]>;
export declare function loadOpenApi(filePath: string): Promise<OpenApiDocument>;
export declare function operationsFromDoc(doc: OpenApiDocument): ApiTool[];
export {};
