#!/usr/bin/env node
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Command } from "commander";
import { loadEnvLocal } from "./env.js";
loadEnvLocal();
import { buildMcpBundle } from "./build.js";
import { getServerEntry, loadMcpConfig, resolveMcpConfigPath, } from "./config.js";
import { formatCompetitorReport, loadRegistry, publicRegistry } from "./competitors.js";
import { formatStateOfMcpReport, loadBenchmarkCatalog, runBenchmark, } from "./benchmark.js";
import { formatEvalReport, runEval } from "./eval.js";
import { formatSuggestedFixes, suggestedFixesFromChecks } from "./improvements.js";
import { formatInspectReport, inspectLiveMcp, mcpToolToApiTool } from "./inspect.js";
import { loadOpenApi, requireOpenApiSpec } from "./load.js";
import { defaultOptimize } from "./optimize.js";
import { operationsFromDoc } from "./openapi.js";
import { packageVersion } from "./pkg.js";
import { formatAnalyzeReport } from "./report.js";
import { formatScorecardReport, runScorecard } from "./scorecard.js";
import { runMcpServer } from "./serve.js";
const version = packageVersion();
const program = new Command();
program
    .name("mcp-doctor")
    .description("Inspect MCP servers and write a local readiness report")
    .version(version)
    .addHelpText("after", [
    "",
    "Live MCP:     list, inspect, eval, benchmark",
    "OpenAPI spec: test, analyze, build, serve",
].join("\n"));
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
function printCliError(err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Error: ${message}`);
    if (process.env.DEBUG === "1" && err instanceof Error && err.stack) {
        console.error(err.stack);
    }
    process.exit(1);
}
program
    .command("list")
    .description("List MCP servers from Cursor/Claude config or ./mcp.json")
    .option("--config <path>", "Path to mcp.json (default: ./mcp.json, then Cursor/Claude)")
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
        console.log("  (no servers - add one in Cursor Settings > MCP)");
    }
    else {
        console.log(`\nInspect: npx @coefficient-work/mcp-doctor@${version} inspect <name>`);
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
            throw new Error("Usage: mcp-doctor inspect <server-name>  OR  --url <mcp-endpoint>. Run `mcp-doctor list` first.");
        }
        serverName = server;
        const path = resolveMcpConfigPath(opts.config);
        entry = getServerEntry(loadMcpConfig(path), serverName, path);
        if (opts.header?.length) {
            entry = { ...entry, headers: { ...entry.headers, ...parseHeaders(opts.header) } };
        }
    }
    console.error(`Connecting to ${serverName}...`);
    const live = await inspectLiveMcp(entry, serverName, { timeoutMs: opts.timeout });
    const malformedIndexes = new Set((live.malformedTools ?? []).map((m) => m.index));
    const malformedNames = new Set((live.malformedTools ?? []).map((m) => m.name));
    const apiTools = live.tools.map((tool, i) => mcpToolToApiTool(tool, {
        missingInputSchema: malformedIndexes.has(i) || malformedNames.has(tool.name),
    }));
    const title = live.serverInfo?.name ?? serverName;
    const discoveryFailed = live.toolCount === 0 && live.errors.length > 0;
    const scorecard = runScorecard({ info: { title } }, apiTools, {
        mode: "live",
        discoveryFailed,
        discoveryError: live.errors[0],
    });
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
    const missingSchema = scorecard.checks.some((c) => c.id === "missing-input-schema" && c.severity === "fail");
    if (discoveryFailed || missingSchema) {
        process.exit(2);
    }
});
program
    .command("eval [server]")
    .description("BYOK agent eval against a live MCP server (task success, friction, replay)")
    .option("--config <path>", "Path to mcp.json")
    .option("--url <url>", "MCP HTTP endpoint")
    .option("-H, --header <key:value>", "HTTP header", (v, acc) => [...acc, v], [])
    .option("-t, --task <text>", "Task for the agent to complete")
    .option("-m, --model <name>", "Model slug (openai/gpt-4o-mini, anthropic/claude-sonnet-4, ollama/llama3.2)", "openai/gpt-4o-mini")
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
            throw new Error('Usage: mcp-doctor eval <server> --task "..."');
        }
        serverName = server;
        const path = resolveMcpConfigPath(opts.config);
        entry = getServerEntry(loadMcpConfig(path), serverName, path);
    }
    const task = opts.task ?? "List all MCP tools and describe what each one does.";
    const models = opts.models?.split(",").map((s) => s.trim()) ?? [opts.model ?? "openai/gpt-4o-mini"];
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
    .description("Score public MCP servers from the bundled catalog (live MCP)")
    .option("-c, --catalog <path>", "benchmark-catalog.json path")
    .option("-o, --out <dir>", "Write reports directory (omit to print summary only)")
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
    if (opts.out) {
        const { mkdir } = await import("node:fs/promises");
        await mkdir(resolve(opts.out), { recursive: true });
        await writeFile(resolve(opts.out, "STATE-OF-MCP-2026.md"), summary, "utf8");
        for (const r of result.reports) {
            await writeFile(resolve(opts.out, `${r.id}.md`), r.markdown, "utf8");
        }
        console.error(`Wrote ${result.reports.length} reports to ${opts.out}/`);
    }
});
program
    .command("test")
    .description("Run agent-readiness scorecard from an OpenAPI spec")
    .argument("[spec]", "OpenAPI path or URL")
    .option("--demo", "Use bundled demo API")
    .option("-o, --out <file>", "Write markdown report to file")
    .option("--json", "Print JSON scorecard")
    .action(async (spec, opts) => {
    const filePath = await requireOpenApiSpec(spec, opts.demo, "test");
    const doc = await loadOpenApi(filePath);
    const result = runScorecard(doc, undefined, { mode: "openapi" });
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
    .description("Report token footprint from an OpenAPI spec (not an MCP server name)")
    .argument("[spec]", "OpenAPI path or URL")
    .option("--demo", "Use bundled demo API")
    .option("-o, --out <file>", "Write markdown report to file")
    .option("-b, --budget <tokens>", "Token budget for final fit pass", parseInt)
    .option("--json", "Print JSON summary to stdout")
    .action(async (spec, opts) => {
    const filePath = await requireOpenApiSpec(spec, opts.demo, "analyze");
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
    .description("Write optimized MCP tool bundle from an OpenAPI spec")
    .argument("[spec]", "OpenAPI path or URL")
    .option("--demo", "Use bundled demo API")
    .option("-o, --out <dir>", "Output directory")
    .option("-b, --budget <tokens>", "Token budget", parseInt)
    .option("-n, --name <name>", "MCP server name in config", "mcp-doctor")
    .action(async (spec, opts) => {
    if (!opts.out) {
        throw new Error("build needs --out <dir>");
    }
    const filePath = await requireOpenApiSpec(spec, opts.demo, "build");
    const doc = await loadOpenApi(filePath);
    const specArg = opts.demo ? "--demo" : spec.startsWith("http") ? spec : filePath;
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
    .description("Run a stdio MCP server from an OpenAPI spec (simulated API responses)")
    .argument("[spec]", "OpenAPI path or URL")
    .option("--demo", "Use bundled demo API")
    .option("-b, --budget <tokens>", "Token budget", parseInt)
    .action(async (spec, opts) => {
    const filePath = await requireOpenApiSpec(spec, opts.demo, "serve");
    const doc = await loadOpenApi(filePath);
    const title = doc.info?.title ?? "API";
    const tools = operationsFromDoc(doc);
    const optimized = defaultOptimize(tools, opts.budget);
    await runMcpServer(optimized.tools, title);
});
program
    .command("competitors")
    .description("Show adjacent MCP tooling (public overlap map)")
    .option("-c, --category <name>", "Filter: standards|generation|gateway|testing|adjacent")
    .option("--json", "Print public overlap JSON")
    .action((opts) => {
    const registry = loadRegistry();
    if (opts.json) {
        console.log(JSON.stringify(publicRegistry(registry), null, 2));
    }
    else {
        console.log(formatCompetitorReport(registry, opts.category));
    }
});
program
    .command("init")
    .description("Print ready-to-paste Cursor MCP config for the demo server")
    .action(async () => {
    const config = {
        mcpServers: {
            "mcp-doctor-demo": {
                command: "npx",
                args: ["-y", "@coefficient-work/mcp-doctor", "serve", "--demo"],
            },
        },
    };
    console.log(JSON.stringify(config, null, 2));
});
program.parseAsync(process.argv).catch(printCliError);
