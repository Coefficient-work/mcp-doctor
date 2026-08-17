import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type Competitor = {
  id: string;
  name: string;
  url: string;
  threat: string;
  overlap: string;
  ourAngle: string;
};

export type CompetitorRegistry = {
  updated: string;
  positioning: string;
  categories: Record<
    string,
    { label: string; competitors: Competitor[] }
  >;
};

export function loadRegistry(): CompetitorRegistry {
  const dir = dirname(fileURLToPath(import.meta.url));
  const raw = readFileSync(resolve(dir, "../competitors/registry.json"), "utf8");
  return JSON.parse(raw) as CompetitorRegistry;
}

export function formatCompetitorReport(registry: CompetitorRegistry, categoryFilter?: string): string {
  const lines = [
    "# MCP Doctor — competitor map",
    "",
    `_${registry.positioning}_`,
    "",
    `Updated: ${registry.updated}`,
    "",
  ];

  for (const [key, cat] of Object.entries(registry.categories)) {
    if (categoryFilter && key !== categoryFilter) continue;
    lines.push(`## ${cat.label}`, "");
    lines.push("| Company | Threat | Overlap | Our angle |");
    lines.push("|---------|--------|---------|-----------|");
    for (const c of cat.competitors) {
      lines.push(`| [${c.name}](${c.url}) | ${c.threat} | ${c.overlap} | ${c.ourAngle} |`);
    }
    lines.push("");
  }

  lines.push("Full analysis: https://github.com/coefficient-work/mcp-doctor/blob/main/docs/competitors/README.md");
  return lines.join("\n");
}

export function listCompetitorIds(registry: CompetitorRegistry): string[] {
  return Object.values(registry.categories).flatMap((c) => c.competitors.map((x) => x.id));
}
