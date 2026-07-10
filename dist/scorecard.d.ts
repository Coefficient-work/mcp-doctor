import type { OpenApiDocument } from "./openapi.js";
import type { ApiTool } from "./openapi.js";
export type CheckSeverity = "pass" | "warn" | "fail" | "info";
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
    checks: ScorecardCheck[];
    toolCount: number;
    tokenCount: number;
};
export declare function runScorecard(doc: OpenApiDocument, tools?: ApiTool[]): ScorecardResult;
export declare function formatScorecardReport(result: ScorecardResult): string;
export declare function topTokenConsumers(tools: ApiTool[], limit?: number): Array<{
    name: string;
    tokens: number;
}>;
