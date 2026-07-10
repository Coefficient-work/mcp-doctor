import type { McpServerEntry } from "./config.js";
import { computeFriction, type ReplayEvent } from "./friction.js";
export type ModelProvider = "openai" | "anthropic";
export type EvalOptions = {
    task: string;
    models?: string[];
    provider?: ModelProvider;
    maxSteps?: number;
    timeoutMs?: number;
};
export type ModelEvalResult = {
    model: string;
    provider: ModelProvider;
    succeeded: boolean;
    friction: ReturnType<typeof computeFriction>;
    events: ReplayEvent[];
    finalAnswer?: string;
    error?: string;
};
export type EvalResult = {
    serverName: string;
    task: string;
    models: ModelEvalResult[];
};
export declare function runEval(entry: McpServerEntry, serverName: string, options: EvalOptions): Promise<EvalResult>;
export declare function formatModelMatrix(results: ModelEvalResult[]): string;
export declare function formatEvalReport(result: EvalResult): string;
