import type { OpenApiDocument } from "./openapi.js";
export type BuildResult = {
    title: string;
    outDir: string;
    baselineTokens: number;
    optimizedTokens: number;
    reductionPct: number;
    toolCount: number;
};
export declare function buildMcpBundle(doc: OpenApiDocument, outDir: string, options?: {
    budget?: number;
    serverName?: string;
    specArg?: string;
}): Promise<BuildResult>;
