import type { McpServerEntry } from "./config.js";
import { computeFriction, type ReplayEvent } from "./friction.js";
export type ModelProvider = "openai" | "anthropic" | "gateway" | "ollama";
export type EvalOptions = {
    task: string;
    models?: string[];
    maxSteps?: number;
    timeoutMs?: number;
};
export type ModelEvalResult = {
    model: string;
    provider: ModelProvider;
    /** @deprecated Use executionProven. Retained for JSON compatibility. */
    succeeded: boolean;
    executionProven?: boolean;
    executionProofReason?: string;
    friction: ReturnType<typeof computeFriction>;
    events: ReplayEvent[];
    finalAnswer?: string;
    error?: string;
    usage?: {
        inputTokens?: number;
        outputTokens?: number;
        totalTokens?: number;
    };
};
export type EvalResult = {
    serverName: string;
    task: string;
    models: ModelEvalResult[];
};
export declare function runEval(entry: McpServerEntry, serverName: string, options: EvalOptions): Promise<EvalResult>;
export declare function evalTaskSucceeded(opts: {
    finishReason?: string;
    events: ReplayEvent[];
}): boolean;
export declare function evalExecutionProof(events: ReplayEvent[]): {
    proven: boolean;
    reason: string;
};
export declare function assertEvalAuth(): void;
export declare function formatModelMatrix(results: ModelEvalResult[]): string;
export declare function formatEvalReport(result: EvalResult): string;
