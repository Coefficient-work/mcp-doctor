import type { ApiTool } from "./openapi.js";
import { toolsTokenCount } from "./tokens.js";

export type OptimizeStrategy =
  | "trim-descriptions"
  | "group-by-tag"
  | "slim-schema"
  | "budget";

export type OptimizeOptions = {
  strategies: OptimizeStrategy[];
  descriptionMaxChars?: number;
  tokenBudget?: number;
};

export type OptimizeResult = {
  tools: ApiTool[];
  strategiesApplied: string[];
  baselineTokens: number;
  optimizedTokens: number;
  reductionPct: number;
};

export function optimizeTools(
  baseline: ApiTool[],
  options: OptimizeOptions,
): OptimizeResult {
  const baselineTokens = toolsTokenCount(baseline);
  let tools = baseline.map(cloneTool);
  const applied: string[] = [];

  for (const strategy of options.strategies) {
    switch (strategy) {
      case "trim-descriptions":
        tools = trimDescriptions(tools, options.descriptionMaxChars ?? 80);
        applied.push(`trim-descriptions(${options.descriptionMaxChars ?? 80})`);
        break;
      case "group-by-tag":
        tools = groupByTag(tools);
        applied.push("group-by-tag");
        break;
      case "slim-schema":
        tools = slimSchemas(tools);
        applied.push("slim-schema");
        break;
      case "budget":
        if (options.tokenBudget) {
          tools = fitBudget(tools, options.tokenBudget);
          applied.push(`budget(${options.tokenBudget})`);
        }
        break;
    }
  }

  const optimizedTokens = toolsTokenCount(tools);
  const reductionPct =
    baselineTokens > 0
      ? Math.round(((baselineTokens - optimizedTokens) / baselineTokens) * 1000) / 10
      : 0;

  return {
    tools,
    strategiesApplied: applied,
    baselineTokens,
    optimizedTokens,
    reductionPct,
  };
}

function cloneTool(tool: ApiTool): ApiTool {
  return structuredClone(tool);
}

function trimDescriptions(tools: ApiTool[], maxChars: number): ApiTool[] {
  return tools.map((tool) => ({
    ...tool,
    description:
      tool.description.length > maxChars
        ? `${tool.description.slice(0, maxChars - 1)}-`
        : tool.description,
  }));
}

function groupByTag(tools: ApiTool[]): ApiTool[] {
  const byTag = new Map<string, ApiTool[]>();
  for (const tool of tools) {
    const list = byTag.get(tool.tag) ?? [];
    list.push(tool);
    byTag.set(tool.tag, list);
  }

  return [...byTag.entries()].map(([tag, group]) => ({
    name: `discover_${sanitize(tag)}`,
    description: `Progressive discovery for ${tag}: ${group.length} operations. Call with action + params.`,
    tag,
    method: "META",
    path: `/${tag}`,
    children: group,
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: group.map((t) => t.name),
          description: "Operation to invoke",
        },
        params: { type: "object", description: "Arguments for the chosen operation" },
      },
      required: ["action"],
    },
  }));
}

function slimSchemas(tools: ApiTool[]): ApiTool[] {
  return tools.map((tool) => ({
    ...tool,
    inputSchema: stripSchemaNoise(tool.inputSchema),
  }));
}

function stripSchemaNoise(schema: Record<string, unknown>): Record<string, unknown> {
  const copy = { ...schema };
  delete copy.example;
  delete copy.examples;
  delete copy.default;

  if (copy.properties && typeof copy.properties === "object") {
    const props: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(
      copy.properties as Record<string, unknown>,
    )) {
      if (value && typeof value === "object") {
        const v = { ...(value as Record<string, unknown>) };
        delete v.example;
        delete v.examples;
        if (typeof v.description === "string" && v.description.length > 60) {
          v.description = `${v.description.slice(0, 59)}-`;
        }
        props[key] = v;
      } else {
        props[key] = value;
      }
    }
    copy.properties = props;
  }
  return copy;
}

function fitBudget(tools: ApiTool[], budget: number): ApiTool[] {
  const sorted = [...tools].sort((a, b) => {
    const priority = (m: string) =>
      m === "GET" ? 0 : m === "POST" ? 1 : m === "PUT" ? 2 : m === "PATCH" ? 3 : 4;
    return priority(a.method) - priority(b.method);
  });

  const selected: ApiTool[] = [];
  for (const tool of sorted) {
    const candidate = [...selected, tool];
    if (toolsTokenCount(candidate) <= budget) {
      selected.push(tool);
    }
  }
  return selected.length ? selected : sorted.slice(0, 1);
}

function sanitize(value: string): string {
  return value.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
}

/** Default concierge pipeline for A3-R2. */
export function defaultOptimize(baseline: ApiTool[], tokenBudget?: number): OptimizeResult {
  const strategies: OptimizeStrategy[] = [
    "trim-descriptions",
    "slim-schema",
    "group-by-tag",
  ];
  if (tokenBudget) strategies.push("budget");
  return optimizeTools(baseline, {
    strategies,
    descriptionMaxChars: 80,
    tokenBudget,
  });
}
