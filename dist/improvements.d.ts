import type { ScorecardCheck } from "./scorecard.js";
import type { ApiTool } from "./openapi.js";
export type SuggestedFix = {
    checkId: string;
    problem: string;
    current?: string;
    suggested: string;
};
export declare function suggestedFixesFromChecks(checks: ScorecardCheck[], tools: ApiTool[]): SuggestedFix[];
export declare function formatSuggestedFixes(fixes: SuggestedFix[]): string;
