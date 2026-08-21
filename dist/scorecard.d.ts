import type { OpenApiDocument } from "./openapi.js";
import type { ApiTool } from "./openapi.js";
export type CheckSeverity = "pass" | "warn" | "fail" | "info";
export type ScorecardMode = "live" | "openapi";
export type ScorecardCheck = {
    id: string;
    category: "tools" | "tokens" | "schema" | "safety" | "auth" | "docs";
    severity: CheckSeverity;
    message: string;
    detail?: string;
};
export type ScorecardResult = {
    title: string;
    score: number;
    grade: string;
    mode: ScorecardMode;
    checks: ScorecardCheck[];
    toolCount: number;
    tokenCount: number;
};
export type ScorecardOptions = {
    mode?: ScorecardMode;
    discoveryFailed?: boolean;
    discoveryError?: string;
};
export declare function formatTruncatedList(items: string[], limit?: number): string;
export declare function runScorecard(doc: OpenApiDocument, tools?: ApiTool[], options?: ScorecardOptions): ScorecardResult;
export declare function argumentLooksLikeSecret(name: string, description?: string): boolean;
export declare function formatScorecardReport(result: ScorecardResult): string;
export declare function topTokenConsumers(tools: ApiTool[], limit?: number): Array<{
    name: string;
    tokens: number;
}>;
