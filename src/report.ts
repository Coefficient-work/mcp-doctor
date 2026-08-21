import type { OptimizeResult } from "./optimize.js";
import type { ApiTool } from "./openapi.js";
import { perToolTokens, toolsTokenCount } from "./tokens.js";

export function formatAnalyzeReport(
  title: string,
  tools: ApiTool[],
  optimized?: OptimizeResult,
): string {
  const lines: string[] = [
    `# mcp-doctor token analysis: ${title}`,
    "",
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Tools (baseline) | ${tools.length} |`,
    `| Tokens (baseline) | ${toolsTokenCount(tools).toLocaleString()} |`,
  ];

  if (optimized) {
    lines.push(
      `| Tools (optimized) | ${optimized.tools.length} |`,
      `| Tokens (optimized) | ${optimized.optimizedTokens.toLocaleString()} |`,
      `| Reduction | **${optimized.reductionPct}%** |`,
      `| Strategies | ${optimized.strategiesApplied.join(" -> ")} |`,
    );
  }

  lines.push("", "## Top token consumers (baseline)", "");
  const ranked = perToolTokens(tools).sort((a, b) => b.tokens - a.tokens).slice(0, 10);
  for (const row of ranked) {
    lines.push(`- \`${row.name}\` - ${row.tokens} tokens`);
  }

  if (optimized) {
    lines.push("", "## Optimized tool surface", "");
    for (const tool of optimized.tools) {
      const desc =
        tool.description.length > 72 ? `${tool.description.slice(0, 69)}...` : tool.description;
      lines.push(`- \`${tool.name}\` (${tool.tag}) - ${desc}`);
    }
  }

  lines.push(
    "",
    "---",
    "_Token estimate: JSON-serialized MCP tool definitions - 4 (concierge benchmark)._",
  );

  return lines.join("\n");
}
