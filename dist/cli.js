#!/usr/bin/env node
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Command } from "commander";
import { buildMcpBundle } from "./build.js";
import { getServerEntry, loadMcpConfig, resolveMcpConfigPath, } from "./config.js";
import { formatCompetitorReport, loadRegistry } from "./competitors.js";
import { formatStateOfMcpReport, loadBenchmarkCatalog, runBenchmark, } from "./benchmark.js";
import { formatEvalReport, runEval } from "./eval.js";
import { formatSuggestedFixes, suggestedFixesFromChecks } from "./improvements.js";
import { formatInspectReport, inspectLiveMcp, mcpToolToApiTool } from "./inspect.js";
import { demoFixturePath, loadOpenApi } from "./load.js";
import { defaultOptimize } from "./optimize.js";
import { operationsFromDoc } from "./openapi.js";
import { formatAnalyzeReport } from "./report.js";
import { formatScorecardReport, runScorecard } from "./scorecard.js";
import { runMcpServer } from "./serve.js";
const program = new Command();
program
    .name("mcp-doctor")
    .description("Agent-facing API QA ? score, inspect, and optimize MCP readiness")
    .version("0.4.0");
async function resolveSpec(spec) {
    if (spec === "--demo") {
        return demoFixturePath();
    }
    if (spec.startsWith("http://") || spec.startsWith("https://")) {
        return spec;
    }
    return resolve(spec);
}
function parseHeaders(headers) {
    const out = {};
    for (const h of headers ?? []) {
        const idx = h.indexOf(":");
        if (idx === -1)
            continue;
        out[h.slice(0, idx).trim()] = h.slice(idx + 1).trim();
    }
    return out;
}
program
    .command("list")
    .description("List MCP servers from your Cursor / Claude config")
    .option("--config <path>", "Path to mcp.json (default: auto-detect)")
    .action((opts) => {
    const path = resolveMcpConfigPath(opts.config);
    const config = loadMcpConfig(path);
    const servers = config.mcpServers ?? {};
    console.log(`Config: ${path}\n`);
    for (const [name, entry] of Object.entries(servers)) {
        const kind = entry.url ? `url ${entry.url}` : `stdio ${entry.command} ${(entry.args ?? []).join(" ")}`;
        console.log(`  ${name}`);
        console.log(`    ${kind}`);
    }
    if (Object.keys(servers).length === 0) {
        console.log("  (no servers ? add one in Cursor Settings ? MCP)");
    }
    else {
        console.log(`\nInspect: npx github:louisreid/mcp-doctor inspect <name>`);
    }
});
program
    .command("inspect [server]")
    .description("Connect to a live MCP server and run agent-readiness scorecard")
    .option("--config <path>", "Path to mcp.json")
    .option("--url <url>", "MCP HTTP/SSE endpoint (skip config file)")
    .option("-H, --header <key:value>", "HTTP header (repeatable)", (v, acc) => [...acc, v], [])
    .option("-o, --out <file>", "Write markdown report to file")
    .option("--json", "Print JSON result")
    .option("--timeout <ms>", "Connection timeout", (v) => parseInt(v, 10), 45_000)
    .action(async (server, opts) => {
    let serverName;
    let entry;
    if (opts.url) {
        serverName = server ?? "remote-mcp";
        entry = { url: opts.url, headers: parseHeaders(opts.header) };
    }
    else {
        if (!server) {
            console.error("Usage: mcp-doctor inspect <server-name>  OR  --url <mcp-endpoint>");
            console.error("Run `mcp-doctor list` to see configured server names.");
            process.exit(1);
        }
        serverName = server;
        const path = resolveMcpConfigPath(opts.config);
        entry = getServerEntry(loadMcpConfig(path), serverName);
        if (opts.header?.length) {
            entry = { ...entry, headers: { ...entry.headers, ...parseHeaders(opts.header) } };
        }
    }
    console.error(`Connecting to ${serverName}...`);
    const live = await inspectLiveMcp(entry, serverName, { timeoutMs: opts.timeout });
    const apiTools = live.tools.map(mcpToolToApiTool);
    const title = live.serverInfo?.name ?? serverName;
    const scorecard = runScorecard({ info: { title } }, apiTools);
    const fixes = suggestedFixesFromChecks(scorecard.checks, apiTools);
    const report = [
        formatInspectReport(live, formatScorecardReport(scorecard)),
        "",
        formatSuggestedFixes(fixes),
    ].join("\n");
    const payload = { live, scorecard };
    if (opts.json) {
        console.log(JSON.stringify(payload, null, 2));
    }
    else {
        console.log(report);
    }
    if (opts.out) {
        await writeFile(resolve(opts.out), report, "utf8");
        console.error(`\nWrote ${opts.out}`);
    }
    if (live.toolCount === 0 && live.errors.length > 0) {
        process.exit(2);
    }
});
program
    .command("test")
    .description("Run agent-readiness scorecard (static checks from OpenAPI)")
    .argument("[spec]", "OpenAPI path or URL")
    .option("--demo", "Use bundled demo API (default if spec omitted)")
    .option("-o, --out <file>", "Write markdown report to file")
    .option("--json", "Print JSON scorecard")
    .action(async (spec, opts) => {
    const useDemo = opts.demo || !spec;
    const filePath = useDemo ? demoFixturePath() : await resolveSpec(spec);
    const doc = await loadOpenApi(filePath);
    const result = runScorecard(doc);
    if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
    }
    else {
        console.log(formatScorecardReport(result));
    }
    if (opts.out) {
        await writeFile(resolve(opts.out), formatScorecardReport(result), "utf8");
        console.error(`\nWrote ${opts.out}`);
    }
});
program
    .command("analyze")
    .description("Report token footprint and optimization opportunities")
    .argument("[spec]", "OpenAPI path or URL")
    .option("--demo", "Use bundled demo API (default if spec omitted)")
    .option("-o, --out <file>", "Write markdown report to file")
    .option("-b, --budget <tokens>", "Token budget for final fit pass", parseInt)
    .option("--json", "Print JSON summary to stdout")
    .action(async (spec, opts) => {
    const useDemo = opts.demo || !spec;
    const filePath = useDemo ? demoFixturePath() : await resolveSpec(spec);
    const doc = await loadOpenApi(filePath);
    const tools = operationsFromDoc(doc);
    const title = doc.info?.title ?? filePath;
    const optimized = defaultOptimize(tools, opts.budget);
    const report = formatAnalyzeReport(title, tools, optimized);
    if (opts.json) {
        console.log(JSON.stringify({
            title,
            toolCount: tools.length,
            baselineTokens: optimized.baselineTokens,
            optimizedTokens: optimized.optimizedTokens,
            reductionPct: optimized.reductionPct,
            strategies: optimized.strategiesApplied,
        }, null, 2));
    }
    else {
        console.log(report);
    }
    if (opts.out) {
        await writeFile(resolve(opts.out), report, "utf8");
        console.error(`\nWrote ${opts.out}`);
    }
});
program
    .command("build")
    .description("Write optimized MCP tool bundle + Cursor config snippet")
    .argument("[spec]", "OpenAPI path or URL")
    .option("--demo", "Use bundled demo API (default if spec omitted)")
    .option("-o, --out <dir>", "Output directory", "./mcp-doctor-out")
    .option("-b, --budget <tokens>", "Token budget", parseInt)
    .option("-n, --name <name>", "MCP server name in config", "mcp-doctor")
    .action(async (spec, opts) => {
    const useDemo = opts.demo || !spec;
    const filePath = useDemo ? demoFixturePath() : await resolveSpec(spec);
    const doc = await loadOpenApi(filePath);
    const specArg = useDemo ? "--demo" : spec.startsWith("http") ? spec : filePath;
    const result = await buildMcpBundle(doc, opts.out, {
        budget: opts.budget,
        serverName: opts.name,
        specArg,
    });
    console.log([
        `Built ${result.title}`,
        `  Tools: ${result.toolCount}`,
        `  Tokens: ${result.baselineTokens} -> ${result.optimizedTokens} (${result.reductionPct}% reduction)`,
        `  Output: ${result.outDir}/`,
        `    tools.json  cursor-mcp.json  TRY-IN-CURSOR.md`,
    ].join("\n"));
});
program
    .command("serve")
    .description("Run stdio MCP server (demo mode ? simulated API responses)")
    .argument("[spec]", "OpenAPI path or URL")
    .option("--demo", "Use bundled demo API (default if spec omitted)")
    .option("-b, --budget <tokens>", "Token budget", parseInt)
    .action(async (spec, opts) => {
    const useDemo = opts.demo || !spec;
    const filePath = useDemo ? demoFixturePath() : await resolveSpec(spec);
    const doc = await loadOpenApi(filePath);
    const title = doc.info?.title ?? "API";
    const tools = operationsFromDoc(doc);
    const optimized = defaultOptimize(tools, opts.budget);
    await runMcpServer(optimized.tools, title);
});
program
    .command("competitors")
    .description("Show competitor map (from ChatGPT + desk research)")
    .option("-c, --category <name>", "Filter: standards|generation|gateway|testing|adjacent")
    .option("--json", "Print registry JSON")
    .action((opts) => {
    const registry = loadRegistry();
    if (opts.json) {
        console.log(JSON.stringify(registry, null, 2));
    }
    else {
        console.log(formatCompetitorReport(registry, opts.category));
    }
});
program
    .command("eval [server]")
    .description("BYOK agent eval ? task success, friction score, replay timeline")
    .option("--config <path>", "Path to mcp.json")
    .option("--url <url>", "MCP HTTP endpoint")
    .option("-H, --header <key:value>", "HTTP header", (v, acc) => [...acc, v], [])
    .option("-t, --task <text>", "Task for the agent to complete")
    .option("-m, --model <name>", "OpenAI model", "gpt-4o-mini")
    .option("--models <names>", "Comma-separated models for compatibility matrix")
    .option("-o, --out <file>", "Write markdown report")
    .option("--json", "Print JSON")
    .action(async (server, opts) => {
    let serverName;
    let entry;
    if (opts.url) {
        serverName = server ?? "remote-mcp";
        entry = { url: opts.url, headers: parseHeaders(opts.header) };
    }
    else {
        if (!server) {
            console.error("Usage: mcp-doctor eval <server> --task \"...\"");
            process.exit(1);
        }
        serverName = server;
        entry = getServerEntry(loadMcpConfig(resolveMcpConfigPath(opts.config)), serverName);
    }
    const task = opts.task ?? "List all MCP tools and describe what each one does.";
    const models = opts.models?.split(",").map((s) => s.trim()) ?? [opts.model ?? "gpt-4o-mini"];
    console.error(`Evaluating ${serverName} with ${models.join(", ")}...`);
    const result = await runEval(entry, serverName, { task, models });
    const report = formatEvalReport(result);
    if (opts.json)
        console.log(JSON.stringify(result, null, 2));
    else
        console.log(report);
    if (opts.out) {
        await writeFile(resolve(opts.out), report, "utf8");
        console.error(`Wrote ${opts.out}`);
    }
});
program
    .command("benchmark")
    .description("State of MCP Quality ? score public MCP servers from catalog")
    .option("-c, --catalog <path>", "benchmark-catalog.json path")
    .option("-o, --out <dir>", "Write reports directory", "./examples/reports")
    .option("--limit <n>", "Max servers to run", (v) => parseInt(v, 10))
    .option("--json", "Print summary JSON only")
    .action(async (opts) => {
    let entries = loadBenchmarkCatalog(opts.catalog);
    if (opts.limit)
        entries = entries.slice(0, opts.limit);
    console.error(`Benchmarking ${entries.length} MCP servers...`);
    const result = await runBenchmark(entries);
    const summary = formatStateOfMcpReport(result.rows);
    if (opts.json) {
        console.log(JSON.stringify({ rows: result.rows }, null, 2));
    }
    else {
        console.log(summary);
    }
    const { mkdir } = await import("node:fs/promises");
    await mkdir(resolve(opts.out), { recursive: true });
    await writeFile(resolve(opts.out, "STATE-OF-MCP-2026.md"), summary, "utf8");
    for (const r of result.reports) {
        await writeFile(resolve(opts.out, `${r.id}.md`), r.markdown, "utf8");
    }
    console.error(`Wrote ${result.reports.length} reports to ${opts.out}/`);
});
program
    .command("init")
    .description("Print ready-to-paste Cursor MCP config for the demo server")
    .action(async () => {
    const config = {
        mcpServers: {
            "mcp-doctor-demo": {
                command: "npx",
                args: ["-y", "github:louisreid/mcp-doctor", "serve", "--demo"],
            },
        },
    };
    console.log(JSON.stringify(config, null, 2));
});
program.parse();
