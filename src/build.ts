import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { defaultOptimize } from "./optimize.js";
import type { OpenApiDocument } from "./openapi.js";
import { operationsFromDoc } from "./openapi.js";
import { cursorMcpConfig, toMcpTools } from "./mcp.js";
import { toolsTokenCount } from "./tokens.js";

export type BuildResult = {
  title: string;
  outDir: string;
  baselineTokens: number;
  optimizedTokens: number;
  reductionPct: number;
  toolCount: number;
};

export async function buildMcpBundle(
  doc: OpenApiDocument,
  outDir: string,
  options?: { budget?: number; serverName?: string; specArg?: string },
): Promise<BuildResult> {
  const title = doc.info?.title ?? "api";
  const baseline = operationsFromDoc(doc);
  const optimized = defaultOptimize(baseline, options?.budget);
  const mcpTools = toMcpTools(optimized.tools);
  const dir = resolve(outDir);
  await mkdir(dir, { recursive: true });

  const serverName = options?.serverName ?? "mcp-doctor";
  const specArg = options?.specArg ?? "--demo";

  const manifest = {
    name: title,
    version: doc.info?.version ?? "0.0.0",
    generatedBy: "mcp-doctor",
    baseline: {
      toolCount: baseline.length,
      tokens: toolsTokenCount(baseline),
    },
    optimized: {
      toolCount: optimized.tools.length,
      tokens: optimized.optimizedTokens,
      reductionPct: optimized.reductionPct,
      strategies: optimized.strategiesApplied,
    },
    tools: mcpTools,
  };

  await writeFile(join(dir, "tools.json"), JSON.stringify(mcpTools, null, 2), "utf8");
  await writeFile(join(dir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
  await writeFile(
    join(dir, "cursor-mcp.json"),
    JSON.stringify(cursorMcpConfig(serverName, specArg), null, 2),
    "utf8",
  );
  await writeFile(
    join(dir, "TRY-IN-CURSOR.md"),
    [
      `# Try ${title} in Cursor`,
      "",
      "1. Copy the `cursor-mcp.json` snippet into your Cursor MCP settings",
      "   (or merge under `mcpServers`).",
      "2. Restart Cursor.",
      "3. Ask the agent to list available tools ù you should see",
      `   **${optimized.tools.length} discovery tools** instead of ${baseline.length} flat operations.`,
      "",
      "## One-liner (demo server)",
      "",
      "```bash",
      "npx @coefficient-work/mcp-doctor@latest serve --demo",
      "```",
      "",
      "**Demo mode** returns simulated responses ù wire your API base URL in a future release.",
    ].join("\n"),
    "utf8",
  );

  return {
    title,
    outDir: dir,
    baselineTokens: optimized.baselineTokens,
    optimizedTokens: optimized.optimizedTokens,
    reductionPct: optimized.reductionPct,
    toolCount: optimized.tools.length,
  };
}
