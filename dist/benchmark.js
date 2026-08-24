import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { connectMcpSession } from "./mcp-client.js";
import { mcpToolToApiTool } from "./inspect.js";
import { formatSuggestedFixes, suggestedFixesFromChecks } from "./improvements.js";
import { formatScorecardReport, runScorecard } from "./scorecard.js";
import { toolsTokenCount } from "./tokens.js";
export function classifyBenchmarkError(error) {
    if (/401|403|unauthori[sz]ed|forbidden|authentication|api[ _-]?key/i.test(error)) {
        return "authentication";
    }
    if (/ENOENT|command not found|executable|spawn .* failed|could not determine executable/i.test(error)) {
        return "launch";
    }
    if (/timed? out|timeout|deadline exceeded/i.test(error)) {
        return "timeout";
    }
    if (/ENOTFOUND|EAI_AGAIN|DNS|network is unreachable|fetch failed/i.test(error)) {
        return "network";
    }
    if (/connection (closed|refused|reset)|ECONNREFUSED|ECONNRESET|MCP error -32000/i.test(error)) {
        return "transport";
    }
    return "unknown";
}
export function loadBenchmarkCatalog(path) {
    const dir = dirname(fileURLToPath(import.meta.url));
    const catalogPath = path ?? join(dir, "../examples/benchmark-catalog.json");
    const raw = JSON.parse(readFileSync(resolve(catalogPath), "utf8"));
    return raw.servers;
}
export async function runBenchmark(entries, options) {
    const rows = [];
    const reports = [];
    for (const item of entries) {
        const t0 = Date.now();
        try {
            const session = await connectMcpSession(item.entry, item.id, options?.timeoutMs ?? 60_000);
            const apiTools = session.tools.map((tool) => mcpToolToApiTool(tool));
            const title = session.serverInfo?.name ?? item.name;
            const scorecard = runScorecard({ info: { title } }, apiTools, { mode: "live" });
            const fixes = suggestedFixesFromChecks(scorecard.checks, apiTools);
            const connectMs = Date.now() - t0;
            const topWarn = scorecard.checks.find((c) => c.severity === "fail" || c.severity === "warn");
            rows.push({
                id: item.id,
                name: item.name,
                grade: scorecard.grade,
                score: scorecard.score,
                toolCount: scorecard.toolCount,
                tokens: toolsTokenCount(apiTools),
                connectMs,
                transport: session.transport,
                topIssue: topWarn?.message,
            });
            const md = [
                `# ${item.name}`,
                "",
                `| Grade | ${scorecard.grade} (${scorecard.score}/100) |`,
                `| Tools | ${scorecard.toolCount} |`,
                `| Tokens | ${toolsTokenCount(apiTools)} |`,
                `| Transport | ${session.transport} |`,
                "",
                formatScorecardReport(scorecard),
                "",
                formatSuggestedFixes(fixes),
            ].join("\n");
            reports.push({ id: item.id, markdown: md });
            await session.close();
        }
        catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            const errorKind = classifyBenchmarkError(msg);
            rows.push({
                id: item.id,
                name: item.name,
                grade: "F",
                score: 0,
                toolCount: 0,
                tokens: 0,
                connectMs: Date.now() - t0,
                transport: "n/a",
                error: msg,
                errorKind,
            });
            reports.push({
                id: item.id,
                markdown: `# ${item.name}\n\n**Error:** ${msg}`,
            });
        }
    }
    return { rows, reports };
}
export function formatStateOfMcpReport(rows, date = new Date().toISOString().slice(0, 10)) {
    const ok = rows.filter((r) => !r.error);
    const sorted = [...ok].sort((a, b) => b.score - a.score);
    const lines = [
        `# State of MCP Quality 2026 (v0)`,
        "",
        `**Date:** ${date}  `,
        `**Servers scored:** ${rows.length} (${ok.length} connected)  `,
        `**Method:** mcp-doctor static scorecard + live tool discovery`,
        "",
        "## Leaderboard",
        "",
        "| Rank | Server | Grade | Score | Tools | Tokens |",
        "|------|--------|-------|-------|-------|--------|",
    ];
    sorted.forEach((r, i) => {
        lines.push(`| ${i + 1} | ${r.name} | ${r.grade} | ${r.score} | ${r.toolCount} | ${r.tokens} |`);
    });
    if (ok.length > 0) {
        const bestDocs = [...ok].sort((a, b) => b.score - a.score)[0];
        const mostTools = [...ok].sort((a, b) => b.toolCount - a.toolCount)[0];
        const lowestTokens = [...ok].sort((a, b) => a.tokens - b.tokens)[0];
        const worstBloat = [...ok].sort((a, b) => b.tokens - a.tokens)[0];
        lines.push("", "## Awards (v0 - static scorecard)", "", `- **Best overall:** ${bestDocs?.name} (Grade ${bestDocs?.grade})`, `- **Lowest token cost:** ${lowestTokens?.name} (${lowestTokens?.tokens} tokens)`, `- **Most tools (bloat risk):** ${mostTools?.name} (${mostTools?.toolCount} tools)`, `- **Worst tool bloat:** ${worstBloat?.name} (${worstBloat?.tokens} tokens)`);
    }
    const failed = rows.filter((r) => r.error);
    if (failed.length > 0) {
        lines.push("", "## Connection failures", "");
        for (const f of failed) {
            const kind = f.errorKind ?? classifyBenchmarkError(f.error ?? "");
            lines.push(`- **${f.name}** [${kind}]: ${f.error}`);
        }
    }
    lines.push("", "---", "_v0 benchmark uses static agent-readiness checks. v1 will add BYOK task evals + friction scores._");
    return lines.join("\n");
}
