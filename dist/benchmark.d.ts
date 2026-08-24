import type { McpServerEntry } from "./config.js";
export type BenchmarkEntry = {
    id: string;
    name: string;
    category: string;
    entry: McpServerEntry;
    defaultTask?: string;
};
export type BenchmarkRow = {
    id: string;
    name: string;
    grade: string;
    score: number;
    toolCount: number;
    tokens: number;
    connectMs: number;
    transport: string;
    topIssue?: string;
    error?: string;
    errorKind?: BenchmarkErrorKind;
};
export type BenchmarkErrorKind = "authentication" | "launch" | "network" | "timeout" | "transport" | "unknown";
export declare function classifyBenchmarkError(error: string): BenchmarkErrorKind;
export type BenchmarkRunResult = {
    rows: BenchmarkRow[];
    reports: Array<{
        id: string;
        markdown: string;
    }>;
};
export declare function loadBenchmarkCatalog(path?: string): BenchmarkEntry[];
export declare function runBenchmark(entries: BenchmarkEntry[], options?: {
    timeoutMs?: number;
}): Promise<BenchmarkRunResult>;
export declare function formatStateOfMcpReport(rows: BenchmarkRow[], date?: string): string;
