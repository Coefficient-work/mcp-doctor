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

export type PublicCompetitor = {
  id: string;
  name: string;
  url: string;
  overlap: string;
};

export function loadRegistry(): CompetitorRegistry {
  const dir = dirname(fileURLToPath(import.meta.url));
  const raw = readFileSync(resolve(dir, "../competitors/registry.json"), "utf8");
  return JSON.parse(raw) as CompetitorRegistry;
}

export function publicRegistry(registry: CompetitorRegistry): {
  updated: string;
  categories: Record<string, { label: string; competitors: PublicCompetitor[] }>;
} {
  const categories: Record<string, { label: string; competitors: PublicCompetitor[] }> = {};
  for (const [key, cat] of Object.entries(registry.categories)) {
    categories[key] = {
      label: cat.label,
      competitors: cat.competitors.map((c) => ({
        id: c.id,
        name: c.name,
        url: c.url,
        overlap: c.overlap,
      })),
    };
  }
  return { updated: registry.updated, categories };
}

export function formatCompetitorReport(
  registry: CompetitorRegistry,
  categoryFilter?: string,
): string {
  const lines = [
    "# MCP Doctor - competitor map",
    "",
    `Updated: ${registry.updated}`,
    "",
  ];

  for (const [key, cat] of Object.entries(registry.categories)) {
    if (categoryFilter && key !== categoryFilter) continue;
    lines.push(`## ${cat.label}`, "");
    lines.push("| Company | Overlap |");
    lines.push("|---------|---------|");
    for (const c of cat.competitors) {
      lines.push(`| [${c.name}](${c.url}) | ${c.overlap} |`);
    }
    lines.push("");
  }

  lines.push("CLI repo: https://github.com/coefficient-work/mcp-doctor");
  return lines.join("\n");
}
