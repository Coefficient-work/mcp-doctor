#!/usr/bin/env node
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Command } from "commander";
import { buildMcpBundle } from "./build.js";
import { demoFixturePath, loadOpenApi } from "./load.js";
import { defaultOptimize } from "./optimize.js";
import { operationsFromDoc } from "./openapi.js";
import { formatAnalyzeReport } from "./report.js";
import { runMcpServer } from "./serve.js";
const program = new Command();
program
    .name("mcp-slim")
    .description("Shrink MCP tool menus from OpenAPI � analyze, build, and serve")
    .version("0.1.0");
async function resolveSpec(spec) {
    if (spec === "--demo") {
        return demoFixturePath();
    }
    if (spec.startsWith("http://") || spec.startsWith("https://")) {
        return spec;
    }
    return resolve(spec);
}
program
    .command("analyze")
    .description("Report baseline vs optimized token footprint")
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
    .option("-o, --out <dir>", "Output directory", "./mcp-slim-out")
    .option("-b, --budget <tokens>", "Token budget", parseInt)
    .option("-n, --name <name>", "MCP server name in config", "mcp-slim")
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
    .description("Run stdio MCP server (demo mode � simulated API responses)")
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
    .command("init")
    .description("Print ready-to-paste Cursor MCP config for the demo server")
    .action(async () => {
    const config = {
        mcpServers: {
            "mcp-slim-demo": {
                command: "npx",
                args: ["-y", "github:louisreid/mcp-slim", "serve", "--demo"],
            },
        },
    };
    console.log(JSON.stringify(config, null, 2));
});
program.parse();
