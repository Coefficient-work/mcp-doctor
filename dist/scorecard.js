import { operationsFromDoc } from "./openapi.js";
import { perToolTokens, toolsTokenCount } from "./tokens.js";
const DESTRUCTIVE_METHODS = new Set(["DELETE", "PUT", "PATCH"]);
const DESTRUCTIVE_NAME_RE = /delete|remove|destroy|purge|drop|cancel|nuke|flush|wipe|kill|terminate|reset|revoke|truncate/i;
const LIST_NAME_RE = /^(list|search|find)_|_list$|_search$/i;
const CREDENTIAL_NAME_RE = /(password|secret|credential|api[_-]?key|(^|_)token$|^token$|pd_token|bearer)/i;
const COMMAND_EXEC_RE = /\bexec\b|\bshell\b|\beval\b|system\(|rm\s+-rf/;
export function runScorecard(doc, tools = operationsFromDoc(doc), options = {}) {
    const mode = options.mode ?? "openapi";
    const title = doc.info?.title ?? "API";
    const checks = [];
    checks.push(...checkToolCount(tools, mode));
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
    const score = computeScore(checks);
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
function computeScore(checks) {
    let score = 100;
    for (const check of checks) {
        if (check.severity === "fail")
            score -= 12;
        else if (check.severity === "warn")
            score -= 5;
    }
    return Math.max(0, Math.min(100, score));
}
function gradeFromScore(score) {
    if (score >= 85)
        return "A";
    if (score >= 70)
        return "B";
    if (score >= 55)
        return "C";
    if (score >= 40)
        return "D";
    return "F";
}
function checkToolCount(tools, mode) {
    const n = tools.length;
    if (n > 40) {
        return [{
                id: "tool-count",
                category: "tools",
                severity: "fail",
                message: `${n} tools - likely hurts agent tool selection`,
                detail: mode === "openapi"
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
function checkTokenFootprint(tools) {
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
function checkDuplicateNames(tools) {
    const names = tools.map((t) => t.name);
    const dupes = names.filter((n, i) => names.indexOf(n) !== i);
    const ambiguous = tools.filter((t) => t.name.length < 4 || /^[a-z]$/.test(t.name));
    const results = [];
    if (dupes.length > 0) {
        results.push({
            id: "duplicate-names",
            category: "tools",
            severity: "fail",
            message: `Duplicate tool names: ${[...new Set(dupes)].join(", ")}`,
        });
    }
    else {
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
            detail: ambiguous.slice(0, 5).map((t) => t.name).join(", "),
        });
    }
    return results;
}
function checkDescriptions(tools) {
    const missing = tools.filter((t) => !t.description || t.description.trim().length < 12);
    if (missing.length > 0) {
        return [{
                id: "descriptions",
                category: "docs",
                severity: "fail",
                message: `${missing.length}/${tools.length} tool(s) have empty or too-short descriptions`,
                detail: missing.slice(0, 5).map((t) => t.name).join(", "),
            }];
    }
    const thin = tools.filter((t) => t.description.trim().length < 30);
    if (thin.length > 0) {
        return [{
                id: "descriptions",
                category: "docs",
                severity: "warn",
                message: `${thin.length} tool(s) have thin descriptions (<30 chars)`,
                detail: thin.slice(0, 5).map((t) => t.name).join(", "),
            }];
    }
    return [{
            id: "descriptions",
            category: "docs",
            severity: "pass",
            message: "Tool descriptions look adequate for agents",
        }];
}
function checkPropertyDescriptions(tools) {
    const missing = [];
    for (const tool of tools) {
        for (const [name, schema] of Object.entries(schemaProperties(tool.inputSchema))) {
            const desc = typeof schema.description === "string" ? schema.description.trim() : "";
            if (!desc)
                missing.push(`${tool.name}.${name}`);
        }
    }
    if (missing.length > 0) {
        return [{
                id: "property-descriptions",
                category: "docs",
                severity: "warn",
                message: `${missing.length} input property(ies) lack a description`,
                detail: missing.slice(0, 8).join(", "),
            }];
    }
    return [{
            id: "property-descriptions",
            category: "docs",
            severity: "pass",
            message: "Input properties include descriptions",
        }];
}
function checkUnconstrainedStrings(tools) {
    const loose = [];
    for (const tool of tools) {
        for (const [name, schema] of Object.entries(schemaProperties(tool.inputSchema))) {
            if (isUnconstrainedString(schema))
                loose.push(`${tool.name}.${name}`);
        }
    }
    if (loose.length > 0) {
        return [{
                id: "unconstrained-strings",
                category: "schema",
                severity: "warn",
                message: `${loose.length} string property(ies) have no enum, format, or pattern`,
                detail: loose.slice(0, 8).join(", "),
            }];
    }
    return [{
            id: "unconstrained-strings",
            category: "schema",
            severity: "pass",
            message: "String inputs are constrained (enum, format, or pattern)",
        }];
}
function checkMissingRequired(tools) {
    const missing = tools.filter((t) => {
        const props = schemaProperties(t.inputSchema);
        if (Object.keys(props).length === 0)
            return false;
        const required = t.inputSchema.required;
        return !Array.isArray(required) || required.length === 0;
    });
    if (missing.length > 0) {
        return [{
                id: "missing-required",
                category: "schema",
                severity: "warn",
                message: `${missing.length} tool(s) have input properties but no required array`,
                detail: missing.slice(0, 5).map((t) => t.name).join(", "),
            }];
    }
    return [{
            id: "missing-required",
            category: "schema",
            severity: "pass",
            message: "Object input schemas declare required properties",
        }];
}
function checkOutputSchema(tools, mode) {
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
            severity: "warn",
            message: mode === "live"
                ? `${missing.length} tool(s) lack an output schema`
                : `${missing.length} operation(s) lack a response schema`,
            detail: missing.slice(0, 5).map((t) => t.name).join(", "),
        }];
}
function checkDestructiveTools(tools) {
    const destructive = tools.filter((t) => DESTRUCTIVE_METHODS.has(t.method) ||
        DESTRUCTIVE_NAME_RE.test(t.name) ||
        DESTRUCTIVE_NAME_RE.test(t.description));
    const unmarked = destructive.filter((t) => !/destructive|danger|irreversible|cannot be undone|permanent/i.test(t.description));
    if (unmarked.length > 0) {
        return [{
                id: "destructive-warnings",
                category: "safety",
                severity: "warn",
                message: `${unmarked.length} destructive tool(s) without explicit warnings in description`,
                detail: unmarked.slice(0, 5).map((t) => t.name).join(", "),
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
function checkSchemaComplexity(tools) {
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
function schemaDepth(obj, depth = 0) {
    if (obj === null || typeof obj !== "object" || depth > 10)
        return depth;
    let max = depth;
    for (const value of Object.values(obj)) {
        max = Math.max(max, schemaDepth(value, depth + 1));
    }
    return max;
}
function checkPagination(tools) {
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
                detail: lacking.slice(0, 5).map((t) => t.name).join(", "),
            }];
    }
    return [{
            id: "pagination",
            category: "schema",
            severity: "pass",
            message: "List/search tools appear to support pagination",
        }];
}
function checkAuthClarity(doc) {
    const security = doc.security;
    const schemes = doc.components;
    const securitySchemes = schemes?.securitySchemes;
    if (!securitySchemes || Object.keys(securitySchemes).length === 0) {
        return [{
                id: "auth-clarity",
                category: "auth",
                severity: "info",
                message: "No security schemes defined in the OpenAPI document",
            }];
    }
    const unnamed = Object.entries(securitySchemes).filter(([, s]) => {
        const scheme = s;
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
function checkCredentialArgs(tools) {
    const leaks = [];
    for (const tool of tools) {
        for (const [name, schema] of Object.entries(schemaProperties(tool.inputSchema))) {
            const desc = typeof schema.description === "string" ? schema.description : "";
            if (CREDENTIAL_NAME_RE.test(name) || CREDENTIAL_NAME_RE.test(desc)) {
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
                detail: leaks.slice(0, 8).join(", "),
            }];
    }
    return [{
            id: "credential-in-args",
            category: "auth",
            severity: "pass",
            message: "No credential-like arguments in tool input schemas",
        }];
}
function checkSecuritySmells(tools, mode) {
    const smells = [];
    for (const tool of tools) {
        const blob = JSON.stringify(tool).toLowerCase();
        if (mode === "openapi" && CREDENTIAL_NAME_RE.test(blob) && tool.method === "GET") {
            smells.push(`${tool.name}: sensitive field on GET`);
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
                detail: smells.slice(0, 5).join("; "),
            }];
    }
    return [{
            id: "security-smells",
            category: "safety",
            severity: "pass",
            message: "No obvious security smells in tool definitions",
        }];
}
export function formatScorecardReport(result) {
    const icon = { pass: "ok", warn: "!", fail: "x", info: "i" };
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
        if (check.detail)
            lines.push(`  - ${check.detail}`);
    }
    lines.push("", "---");
    if (result.mode === "live") {
        lines.push("_Live MCP inspect scorecard. Reports stay on this machine._", "", "**Next:** `mcp-doctor eval <server> --task \"...\"` for a BYOK agent run, or `mcp-doctor list` to see config names.");
    }
    else {
        lines.push("_Static scorecard from an OpenAPI spec projected as MCP tools._", "", "**Next:** `mcp-doctor analyze <spec>` for token optimization, or `mcp-doctor build <spec>` for a tool bundle.");
    }
    return lines.join("\n");
}
export function topTokenConsumers(tools, limit = 5) {
    return perToolTokens(tools).sort((a, b) => b.tokens - a.tokens).slice(0, limit);
}
function schemaProperties(schema) {
    const props = schema?.properties;
    if (!props || typeof props !== "object" || Array.isArray(props))
        return {};
    return props;
}
function isUnconstrainedString(schema) {
    if (schema.type !== "string")
        return false;
    if (Array.isArray(schema.enum) && schema.enum.length > 0)
        return false;
    if (typeof schema.format === "string" && schema.format.length > 0)
        return false;
    if (typeof schema.pattern === "string" && schema.pattern.length > 0)
        return false;
    return true;
}
function hasUsefulOutputSchema(schema) {
    if (!schema || typeof schema !== "object")
        return false;
    const props = schemaProperties(schema);
    if (schema.type === "object" && Object.keys(props).length === 0 && !schema.additionalProperties) {
        return false;
    }
    return Object.keys(schema).length > 0;
}
