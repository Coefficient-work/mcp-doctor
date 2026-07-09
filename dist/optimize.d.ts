import type { ApiTool } from "./openapi.js";
export type OptimizeStrategy = "trim-descriptions" | "group-by-tag" | "slim-schema" | "budget";
export type OptimizeOptions = {
    strategies: OptimizeStrategy[];
    descriptionMaxChars?: number;
    tokenBudget?: number;
};
export type OptimizeResult = {
    tools: ApiTool[];
    strategiesApplied: string[];
    baselineTokens: number;
    optimizedTokens: number;
    reductionPct: number;
};
export declare function optimizeTools(baseline: ApiTool[], options: OptimizeOptions): OptimizeResult;
/** Default concierge pipeline for A3-R2. */
export declare function defaultOptimize(baseline: ApiTool[], tokenBudget?: number): OptimizeResult;
