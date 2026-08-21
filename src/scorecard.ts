import { humanizeListToolsError } from "./inspect-errors.js";
import type { OpenApiDocument } from "./openapi.js";
import type { ApiTool } from "./openapi.js";
import { operationsFromDoc } from "./openapi.js";
import { perToolTokens, toolsTokenCount } from "./tokens.js";

export type CheckSeverity = "pass" | "warn" | "fail" | "info";
export type ScorecardMode = "live" | "openapi";

export type ScorecardCheck = {
  id: string;
  category: "tools" | "tokens" | "schema" | "safety" | "auth" | "docs";
  severity: CheckSeverity;
  message: string;
  detail?: string;
};

export type ScorecardResult = {
  title: string;
  score: number;
  grade: string;
  mode: ScorecardMode;
  checks: ScorecardCheck[];
  toolCount: number;
  tokenCount: number;
};

export type ScorecardOptions = {
  mode?: ScorecardMode;
  discoveryFailed?: boolean;
  discoveryError?: string;
};

const DESTRUCTIVE_METHODS = new Set(["DELETE", "PUT", "PATCH"]);
const DESTRUCTIVE_NAME_RE =
  /delete|remove|destroy|purg(e|ing|ed)|drop|cancel|nuke|flush|wipe|kill|terminate|reset|revoke|truncate|zeroing|zeroed|\bzero\b|overwrit|prun(e|ing)|reboot/i;
const DESTRUCTIVE_DESC_STRONG_RE =
  /purging|zeroing|wiping|destroying|nuking|truncating|irreversible|cannot be undone|wipe(s|d)? all/i;
const UPDATE_STYLE_NAME_RE = /^(update|configure|set)_/i;
const DESTRUCTIVE_MARKED_RE = /destructive|danger|irreversible|cannot be undone|permanent|caution/i;
const LIST_NAME_RE = /^(list|search|find)_|_list$|_search$/i;
const SECRET_VALUE_NAME_RE =
  /^(api[_-]?key|secret_api_key|signing_secret|pd_token|password|passwd|secret|credential)$|(^|_)(api[_-]?key|api[_-]?token|password|passwd|signing_secret)$|(^|_)token$/i;
const SECRET_REFERENCE_NAME_RE = /(^|_)(ref|pointer)$|(^|_)vault(_|$)|^vault_/i;
const SECRET_VALUE_DESC_RE =
  /\bbearer token\b|\bhmac secret\b|\bapi key to pass\b|\bthe (actual )?(api )?key itself\b/i;
const COMMAND_EXEC_RE = /\bexec\b|\bshell\b|\beval\b|system\(|rm\s+-rf/;
const IDENTIFIER_OR_QUERY_RE =
  /^(id|.+_id|sku|uuid|slug|name|query|filter.*|q|search|path|url|uri|host|email|description|text|message|content|prompt|expr|expression)$/i;
const ENUM_LIKE_NAME_RE = /^(status|type|mode|kind|category|scope|format|provider|channel|report_type|event_type)$/i;
const DETAIL_LIST_LIMIT = 8;

export function formatTruncatedList(items: string[], limit = DETAIL_LIST_LIMIT): string {
  if (items.length <= limit) return items.join(", ");
  return `${items.slice(0, limit).join(", ")} (+${items.length - limit} more)`;
}

export function runScorecard(
  doc: OpenApiDocument,
  tools: ApiTool[] = operationsFromDoc(doc),
  options: ScorecardOptions = {},
): ScorecardResult {
  const mode = options.mode ?? "openapi";
  const title = doc.info?.title ?? "API";

  if (options.discoveryFailed) {
    return {
      title,
      score: 0,
      grade: "F",
      mode,
      checks: [{
        id: "discovery",
        category: "tools",
        severity: "fail",
        message: "Tool discovery failed - scorecard skipped",
        detail: humanizeListToolsError(options.discoveryError ?? "listTools returned no tools"),
      }],
      toolCount: 0,
      tokenCount: 0,
    };
  }

  const checks: ScorecardCheck[] = [];

  checks.push(...checkToolCount(tools, mode));
  checks.push(...checkMissingInputSchema(tools));
  checks.push(...checkTokenFootprint(tools));
  checks.push(...checkDuplicateNames(tools));
  checks.push(...checkDescriptions(tools));
  checks.push(...checkPropertyDescriptions(tools));
  checks.push(...checkUnconstrainedStrings(tools));
  checks.push(...checkMissingRequired(tools));
  checks.push(...checkOutputSchema(tools, mode));
  checks.push(...checkDestructiveTools(tools));
  checks.push(...checkSchemaComplexity(tools));
  checks.push(...checkPagination(tools));
  if (mode === "openapi") {
    checks.push(...checkAuthClarity(doc));
  }
  checks.push(...checkCredentialArgs(tools));
  checks.push(...checkSecuritySmells(tools, mode));

  const score = tools.length === 0 ? 0 : computeScore(checks);
  return {
    title,
    score,
    grade: gradeFromScore(score),
    mode,
    checks,
    toolCount: tools.length,
    tokenCount: toolsTokenCount(tools),
  };
}

function computeScore(checks: ScorecardCheck[]): number {
  let score = 100;
  for (const check of checks) {
    if (check.severity === "fail") score -= 12;
    else if (check.severity === "warn") score -= 5;
  }
  return Math.max(0, Math.min(100, score));
}

function gradeFromScore(score: number): string {
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 55) return "C";
  if (score >= 40) return "D";
  return "F";
}

function checkToolCount(tools: ApiTool[], mode: ScorecardMode): ScorecardCheck[] {
  const n = tools.length;
  if (n === 0) {
    return [{
      id: "tool-count",
      category: "tools",
      severity: "fail",
      message: "0 tools advertised - server exposes no agent-callable surface",
    }];
  }
  if (n > 40) {
    return [{
      id: "tool-count",
      category: "tools",
      severity: "fail",
      message: `${n} tools - likely hurts agent tool selection`,
      detail:
        mode === "openapi"
          ? "Consider progressive discovery or grouping (see `mcp-doctor analyze --demo`)"
          : "Consider grouping tools or progressive discovery so agents see fewer than 15 at once",
    }];
  }
  if (n > 15) {
    return [{
      id: "tool-count",
      category: "tools",
      severity: "warn",
      message: `${n} tools - high context cost for agents`,
    }];
  }
  return [{
    id: "tool-count",
    category: "tools",
    severity: "pass",
    message: `${n} tools - reasonable surface area`,
  }];
}

function checkTokenFootprint(tools: ApiTool[]): ScorecardCheck[] {
  const tokens = toolsTokenCount(tools);
  if (tokens > 20_000) {
    return [{
      id: "token-footprint",
      category: "tokens",
      severity: "fail",
      message: `~${tokens.toLocaleString()} tokens in tool definitions`,
      detail: "Agents may exhaust context before user tasks",
    }];
  }
  if (tokens > 8_000) {
    return [{
      id: "token-footprint",
      category: "tokens",
      severity: "warn",
      message: `~${tokens.toLocaleString()} tokens in tool definitions`,
    }];
  }
  return [{
    id: "token-footprint",
    category: "tokens",
    severity: "pass",
    message: `~${tokens.toLocaleString()} tokens in tool definitions`,
  }];
}

function checkDuplicateNames(tools: ApiTool[]): ScorecardCheck[] {
  const names = tools.map((t) => t.name);
  const dupes = names.filter((n, i) => names.indexOf(n) !== i);
  const ambiguous = tools.filter((t) => t.name.length < 4 || /^[a-z]$/.test(t.name));
  const results: ScorecardCheck[] = [];

  if (dupes.length > 0) {
    results.push({
      id: "duplicate-names",
      category: "tools",
      severity: "fail",
      message: `Duplicate tool names: ${[...new Set(dupes)].join(", ")}`,
    });
  } else {
    results.push({
      id: "duplicate-names",
      category: "tools",
      severity: "pass",
      message: "No duplicate tool names",
    });
  }

  if (ambiguous.length > 0) {
    results.push({
      id: "ambiguous-names",
      category: "tools",
      severity: "warn",
      message: `${ambiguous.length} tool(s) with very short or unclear names`,
      detail: formatTruncatedList(ambiguous.map((t) => t.name)),
    });
  }

  return results;
}

function checkDescriptions(tools: ApiTool[]): ScorecardCheck[] {
  const missing = tools.filter((t) => !t.description || t.description.trim().length < 12);
  if (missing.length > 0) {
    return [{
      id: "descriptions",
      category: "docs",
      severity: "fail",
      message: `${missing.length}/${tools.length} tool(s) have empty or too-short descriptions`,
      detail: formatTruncatedList(missing.map((t) => t.name)),
    }];
  }
  const thin = tools.filter((t) => t.description.trim().length < 30);
  if (thin.length > 0) {
    return [{
      id: "descriptions",
      category: "docs",
      severity: "warn",
      message: `${thin.length} tool(s) have thin descriptions (<30 chars)`,
      detail: formatTruncatedList(thin.map((t) => t.name)),
    }];
  }
  return [{
    id: "descriptions",
    category: "docs",
    severity: "pass",
    message: "Tool descriptions look adequate for agents",
  }];
}

function checkPropertyDescriptions(tools: ApiTool[]): ScorecardCheck[] {
  const missing: string[] = [];
  for (const tool of tools) {
    for (const [name, schema] of Object.entries(schemaProperties(tool.inputSchema))) {
      const desc = typeof schema.description === "string" ? schema.description.trim() : "";
      if (!desc) missing.push(`${tool.name}.${name}`);
    }
  }
  if (missing.length > 0) {
    return [{
      id: "property-descriptions",
      category: "docs",
      severity: "warn",
      message: `${missing.length} input property(ies) lack a description`,
      detail: formatTruncatedList(missing),
    }];
  }
  return [{
    id: "property-descriptions",
    category: "docs",
    severity: "pass",
    message: "Input properties include descriptions",
  }];
}

function checkUnconstrainedStrings(tools: ApiTool[]): ScorecardCheck[] {
  const enumLike: string[] = [];
  const remaining: string[] = [];
  for (const tool of tools) {
    for (const [name, schema] of Object.entries(schemaProperties(tool.inputSchema))) {
      if (!isUnconstrainedString(schema)) continue;
      if (IDENTIFIER_OR_QUERY_RE.test(name)) continue;
      const label = `${tool.name}.${name}`;
      if (ENUM_LIKE_NAME_RE.test(name)) enumLike.push(label);
      else remaining.push(label);
    }
  }
  if (enumLike.length > 0) {
    return [{
      id: "unconstrained-strings",
      category: "schema",
      severity: "warn",
      message: `${enumLike.length} enum-like string(s) have no enum, format, or pattern`,
      detail: formatTruncatedList(enumLike),
    }, ...(remaining.length > 0
      ? [{
          id: "unconstrained-strings",
          category: "schema" as const,
          severity: "info" as const,
          message: `${remaining.length} free-form string(s) have no enum, format, or pattern`,
          detail: formatTruncatedList(remaining),
        }]
      : [])];
  }
  if (remaining.length > 0) {
    return [{
      id: "unconstrained-strings",
      category: "schema",
      severity: "info",
      message: `${remaining.length} free-form string(s) have no enum, format, or pattern`,
      detail: formatTruncatedList(remaining),
    }];
  }
  return [{
    id: "unconstrained-strings",
    category: "schema",
    severity: "pass",
    message: "String inputs are constrained (enum, format, or pattern)",
  }];
}

function checkMissingInputSchema(tools: ApiTool[]): ScorecardCheck[] {
  const missing = tools.filter((t) => t.missingInputSchema);
  if (missing.length === 0) return [];
  return [{
    id: "missing-input-schema",
    category: "schema",
    severity: "fail",
    message: `${missing.length} tool(s) omitted required inputSchema`,
    detail: formatTruncatedList(missing.map((t) => t.name)),
  }];
}

function checkMissingRequired(tools: ApiTool[]): ScorecardCheck[] {
  const missing = tools.filter((t) => {
    const props = schemaProperties(t.inputSchema);
    if (Object.keys(props).length === 0) return false;
    const required = t.inputSchema.required;
    return !Array.isArray(required);
  });
  if (missing.length > 0) {
    return [{
      id: "missing-required",
      category: "schema",
      severity: "warn",
      message: `${missing.length} tool(s) have input properties but no required array`,
      detail: formatTruncatedList(missing.map((t) => t.name)),
    }];
  }
  return [{
    id: "missing-required",
    category: "schema",
    severity: "pass",
    message: "Object input schemas declare required properties",
  }];
}

function checkOutputSchema(tools: ApiTool[], mode: ScorecardMode): ScorecardCheck[] {
  const missing = tools.filter((t) => !hasUsefulOutputSchema(t.outputSchema));
  if (missing.length === 0) {
    return [{
      id: "output-schema",
      category: "schema",
      severity: "pass",
      message: "Tools declare output schemas",
    }];
  }
  return [{
    id: "output-schema",
    category: "schema",
    severity: mode === "live" ? "info" : "warn",
    message:
      mode === "live"
        ? `${missing.length} tool(s) lack an output schema (optional on live MCP)`
        : `${missing.length} operation(s) lack a response schema`,
    detail: formatTruncatedList(missing.map((t) => t.name)),
  }];
}

function isDestructiveTool(tool: ApiTool): boolean {
  if (DESTRUCTIVE_METHODS.has(tool.method) || DESTRUCTIVE_NAME_RE.test(tool.name)) {
    return true;
  }
  if (UPDATE_STYLE_NAME_RE.test(tool.name)) {
    return DESTRUCTIVE_DESC_STRONG_RE.test(tool.description);
  }
  return DESTRUCTIVE_DESC_STRONG_RE.test(tool.description);
}

function checkDestructiveTools(tools: ApiTool[]): ScorecardCheck[] {
  const destructive = tools.filter(isDestructiveTool);
  const unmarked = destructive.filter((t) => !DESTRUCTIVE_MARKED_RE.test(t.description));

  if (unmarked.length > 0) {
    return [{
      id: "destructive-warnings",
      category: "safety",
      severity: "warn",
      message: `${unmarked.length} destructive tool(s) without explicit warnings in description`,
      detail: formatTruncatedList(unmarked.map((t) => t.name)),
    }];
  }
  if (destructive.length > 0) {
    return [{
      id: "destructive-warnings",
      category: "safety",
      severity: "pass",
      message: `${destructive.length} destructive tool(s) marked appropriately`,
    }];
  }
  return [{
    id: "destructive-warnings",
    category: "safety",
    severity: "info",
    message: "No obviously destructive operations detected",
  }];
}

function checkSchemaComplexity(tools: ApiTool[]): ScorecardCheck[] {
  const complex = tools.filter((t) => {
    const props = schemaProperties(t.inputSchema);
    const depth = schemaDepth(t.inputSchema);
    return Object.keys(props).length > 12 || depth > 4;
  });

  if (complex.length > tools.length * 0.25 && complex.length > 0) {
    return [{
      id: "schema-complexity",
      category: "schema",
      severity: "warn",
      message: `${complex.length} tools have complex input schemas`,
      detail: "Deep or wide schemas increase parameter mistakes",
    }];
  }
  return [{
    id: "schema-complexity",
    category: "schema",
    severity: "pass",
    message: "Input schemas are reasonably sized",
  }];
}

function schemaDepth(obj: unknown, depth = 0): number {
  if (obj === null || typeof obj !== "object" || depth > 10) return depth;
  let max = depth;
  for (const value of Object.values(obj as Record<string, unknown>)) {
    max = Math.max(max, schemaDepth(value, depth + 1));
  }
  return max;
}

function checkPagination(tools: ApiTool[]): ScorecardCheck[] {
  const listOps = tools.filter((t) => LIST_NAME_RE.test(t.name) || LIST_NAME_RE.test(t.path));
  if (listOps.length === 0) {
    return [{
      id: "pagination",
      category: "schema",
      severity: "info",
      message: "No list/search tools detected - pagination check skipped",
    }];
  }

  const lacking = listOps.filter((t) => {
    const keys = Object.keys(schemaProperties(t.inputSchema)).join(" ").toLowerCase();
    return !/page|cursor|offset|limit|after|before/.test(keys);
  });

  if (lacking.length > 0) {
    return [{
      id: "pagination",
      category: "schema",
      severity: "warn",
      message: `${lacking.length} list/search tool(s) may lack pagination parameters`,
      detail: formatTruncatedList(lacking.map((t) => t.name)),
    }];
  }
  return [{
    id: "pagination",
    category: "schema",
    severity: "pass",
    message: "List/search tools appear to support pagination",
  }];
}

function checkAuthClarity(doc: OpenApiDocument): ScorecardCheck[] {
  const security = (doc as Record<string, unknown>).security as unknown[] | undefined;
  const schemes = (doc as Record<string, unknown>).components as Record<string, unknown> | undefined;
  const securitySchemes = schemes?.securitySchemes as Record<string, unknown> | undefined;

  if (!securitySchemes || Object.keys(securitySchemes).length === 0) {
    return [{
      id: "auth-clarity",
      category: "auth",
      severity: "info",
      message: "No security schemes defined in the OpenAPI document",
    }];
  }

  const unnamed = Object.entries(securitySchemes).filter(([, s]) => {
    const scheme = s as Record<string, unknown>;
    return !scheme.description && !scheme.type;
  });

  if (unnamed.length > 0) {
    return [{
      id: "auth-clarity",
      category: "auth",
      severity: "warn",
      message: `${unnamed.length} auth scheme(s) lack description - agents struggle with auth recovery`,
    }];
  }

  if (!security || security.length === 0) {
    return [{
      id: "auth-clarity",
      category: "auth",
      severity: "warn",
      message: "Security schemes defined but no global security requirements",
    }];
  }

  return [{
    id: "auth-clarity",
    category: "auth",
    severity: "pass",
    message: `Auth schemes documented (${Object.keys(securitySchemes).join(", ")})`,
  }];
}

export function argumentLooksLikeSecret(name: string, description = ""): boolean {
  if (SECRET_REFERENCE_NAME_RE.test(name)) {
    return SECRET_VALUE_DESC_RE.test(description);
  }
  if (SECRET_VALUE_NAME_RE.test(name)) return true;
  if (/secret_api_key/i.test(name)) return true;
  return false;
}

function checkCredentialArgs(tools: ApiTool[]): ScorecardCheck[] {
  const leaks: string[] = [];
  for (const tool of tools) {
    for (const [name, schema] of Object.entries(schemaProperties(tool.inputSchema))) {
      const desc = typeof schema.description === "string" ? schema.description : "";
      if (argumentLooksLikeSecret(name, desc)) {
        leaks.push(`${tool.name}.${name}`);
      }
    }
  }
  if (leaks.length > 0) {
    return [{
      id: "credential-in-args",
      category: "auth",
      severity: "fail",
      message: `${leaks.length} tool argument(s) look like secrets in the LLM-visible schema`,
      detail: formatTruncatedList(leaks),
    }];
  }
  return [{
    id: "credential-in-args",
    category: "auth",
    severity: "pass",
    message: "No credential-like arguments in tool input schemas",
  }];
}

function checkSecuritySmells(tools: ApiTool[], mode: ScorecardMode): ScorecardCheck[] {
  const smells: string[] = [];
  for (const tool of tools) {
    const blob = JSON.stringify(tool).toLowerCase();
    if (mode === "openapi" && tool.method === "GET") {
      for (const [name, schema] of Object.entries(schemaProperties(tool.inputSchema))) {
        const desc = typeof schema.description === "string" ? schema.description : "";
        if (argumentLooksLikeSecret(name, desc)) {
          smells.push(`${tool.name}: sensitive field on GET`);
          break;
        }
      }
    }
    if (COMMAND_EXEC_RE.test(blob)) {
      smells.push(`${tool.name}: possible command execution surface`);
    }
  }

  if (smells.length > 0) {
    return [{
      id: "security-smells",
      category: "safety",
      severity: "fail",
      message: `${smells.length} potential security smell(s)`,
      detail: formatTruncatedList(smells),
    }];
  }
  return [{
    id: "security-smells",
    category: "safety",
    severity: "pass",
    message: "No obvious security smells in tool definitions",
  }];
}

export function formatScorecardReport(result: ScorecardResult): string {
  const icon: Record<CheckSeverity, string> = { pass: "ok", warn: "!", fail: "x", info: "i" };
  const lines = [
    `# MCP Agent Readiness: ${result.title}`,
    "",
    `**Score: ${result.score}/100 (Grade ${result.grade})**`,
    "",
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Tools | ${result.toolCount} |`,
    `| Est. tokens | ${result.tokenCount.toLocaleString()} |`,
    `| Checks | ${result.checks.length} |`,
    `| Source | ${result.mode === "live" ? "live MCP" : "OpenAPI spec"} |`,
    "",
    "## Checks",
    "",
  ];

  for (const check of result.checks) {
    lines.push(`- [${icon[check.severity]}] **${check.id}** - ${check.message}`);
    if (check.detail) lines.push(`  - ${check.detail}`);
  }

  lines.push("", "---");
  if (result.mode === "live") {
    lines.push(
      "_Live MCP inspect scorecard. Reports stay on this machine._",
      "",
      "**Next:** `mcp-doctor eval <server> --task \"...\"` for a BYOK agent run, or `mcp-doctor list` to see config names.",
    );
  } else {
    lines.push(
      "_Static scorecard from an OpenAPI spec projected as MCP tools._",
      "",
      "**Next:** `mcp-doctor analyze <spec>` for token optimization, or `mcp-doctor build <spec>` for a tool bundle.",
    );
  }

  return lines.join("\n");
}

export function topTokenConsumers(tools: ApiTool[], limit = 5): Array<{ name: string; tokens: number }> {
  return perToolTokens(tools).sort((a, b) => b.tokens - a.tokens).slice(0, limit);
}

function schemaProperties(schema: Record<string, unknown> | undefined): Record<string, Record<string, unknown>> {
  const props = schema?.properties;
  if (!props || typeof props !== "object" || Array.isArray(props)) return {};
  return props as Record<string, Record<string, unknown>>;
}

function isUnconstrainedString(schema: Record<string, unknown>): boolean {
  if (schema.type !== "string") return false;
  if (Array.isArray(schema.enum) && schema.enum.length > 0) return false;
  if (typeof schema.format === "string" && schema.format.length > 0) return false;
  if (typeof schema.pattern === "string" && schema.pattern.length > 0) return false;
  return true;
}

function hasUsefulOutputSchema(schema: Record<string, unknown> | undefined): boolean {
  if (!schema || typeof schema !== "object") return false;
  const props = schemaProperties(schema);
  if (schema.type === "object" && Object.keys(props).length === 0 && !schema.additionalProperties) {
    return false;
  }
  return Object.keys(schema).length > 0;
}
