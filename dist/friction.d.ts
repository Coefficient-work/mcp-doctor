export type ReplayEvent = {
    step: number;
    type: "assistant" | "tool_call" | "tool_result" | "error";
    summary: string;
    detail?: string;
    toolName?: string;
    isError?: boolean;
    latencyMs?: number;
};
export type FrictionBreakdown = {
    score: number;
    retries: number;
    wrongToolCalls: number;
    toolCalls: number;
    unnecessaryCalls: number;
    authRecovery: boolean;
    totalSteps: number;
    reasons: string[];
};
export declare function computeFriction(events: ReplayEvent[], succeeded: boolean): FrictionBreakdown;
export declare function formatReplayTimeline(events: ReplayEvent[]): string;
export declare function formatFrictionReport(friction: FrictionBreakdown, executionProven: boolean, executionProofReason?: string): string;
